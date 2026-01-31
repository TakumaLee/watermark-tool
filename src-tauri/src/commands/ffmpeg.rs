use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use crate::ffmpeg::overlay::{build_filter_complex, quality_to_crf};
use crate::ffmpeg::probe::probe_video_info;
use crate::ffmpeg::{BatchItemConfig, BatchProgressEvent, VideoInfo, WatermarkConfig};

/// Global map of running render processes and their progress (0.0 - 1.0).
static RENDER_PROGRESS: Lazy<Arc<Mutex<HashMap<String, f64>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

/// Global set of cancelled batch/render IDs.
static CANCELLED: Lazy<Arc<Mutex<std::collections::HashSet<String>>>> =
    Lazy::new(|| Arc::new(Mutex::new(std::collections::HashSet::new())));

/// Render state shared between the spawned task and the progress query.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RenderState {
    progress: f64,
}

/// Probe a video file and return its metadata.
#[tauri::command]
pub async fn probe_video(path: String) -> Result<VideoInfo, String> {
    // Run blocking ffprobe on a dedicated thread
    tokio::task::spawn_blocking(move || probe_video_info(&path))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

/// Render a video with watermark overlays using FFmpeg.
///
/// This spawns an FFmpeg process asynchronously and tracks its progress
/// via the global RENDER_PROGRESS map.
#[tauri::command]
pub async fn render_video(
    input: String,
    output: String,
    watermarks: Vec<WatermarkConfig>,
    quality: String,
) -> Result<String, String> {
    // First, probe the input video to get dimensions
    let video_info = probe_video_info(&input)?;

    // Generate a process ID for progress tracking
    let process_id = format!(
        "render_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    // Initialize progress
    {
        let mut progress_map = RENDER_PROGRESS
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        progress_map.insert(process_id.clone(), 0.0);
    }

    let pid = process_id.clone();
    let duration = video_info.duration;

    // Spawn the render task
    tokio::task::spawn_blocking(move || {
        let result = run_ffmpeg_render(
            &input,
            &output,
            &watermarks,
            &quality,
            video_info.width,
            video_info.height,
            duration,
            &pid,
        );

        // Mark as complete or remove on error
        if let Ok(mut progress_map) = RENDER_PROGRESS.lock() {
            if result.is_ok() {
                progress_map.insert(pid.clone(), 1.0);
            } else {
                progress_map.remove(&pid);
            }
        }

        result
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(process_id)
}

/// Get the current render progress for a given process ID.
/// Returns a value between 0.0 and 1.0.
#[tauri::command]
pub async fn get_render_progress(process_id: String) -> Result<f64, String> {
    let progress_map = RENDER_PROGRESS
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;

    Ok(*progress_map.get(&process_id).unwrap_or(&-1.0))
}

/// Run the actual FFmpeg render process (blocking).
fn run_ffmpeg_render(
    input: &str,
    output: &str,
    watermarks: &[WatermarkConfig],
    quality: &str,
    video_width: u32,
    video_height: u32,
    duration: f64,
    process_id: &str,
) -> Result<(), String> {
    let (crf, preset) = quality_to_crf(quality);

    let mut args: Vec<String> = Vec::new();

    // Overwrite output without asking
    args.push("-y".to_string());

    // Input video
    args.push("-i".to_string());
    args.push(input.to_string());

    // Build filter complex if watermarks exist
    let filter_result = build_filter_complex(watermarks, video_width, video_height);

    // Add watermark input files
    args.extend(filter_result.input_args);

    if !filter_result.filter_complex.is_empty() {
        args.push("-filter_complex".to_string());
        args.push(filter_result.filter_complex);
        args.push("-map".to_string());
        args.push(filter_result.output_label);
        args.push("-map".to_string());
        args.push("0:a?".to_string()); // Copy audio if present
    }

    // Encoding settings
    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-crf".to_string());
    args.push(crf.to_string());
    args.push("-preset".to_string());
    args.push(preset.to_string());
    args.push("-c:a".to_string());
    args.push("copy".to_string());

    // Progress output
    args.push("-progress".to_string());
    args.push("pipe:2".to_string());

    // Output file
    args.push(output.to_string());

    log::info!("Running FFmpeg: ffmpeg {}", args.join(" "));

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}. Is FFmpeg installed?", e))?;

    // Read stderr for progress parsing
    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let pid = process_id.to_string();

        for line in reader.lines() {
            if let Ok(line) = line {
                // Parse progress from FFmpeg stderr output
                // Look for lines like: out_time_us=12345678 or time=00:01:23.45
                if let Some(progress) = parse_ffmpeg_progress(&line, duration) {
                    if let Ok(mut progress_map) = RENDER_PROGRESS.lock() {
                        progress_map.insert(pid.clone(), progress.clamp(0.0, 0.99));
                    }
                }
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    if !status.success() {
        return Err(format!(
            "FFmpeg exited with status: {}",
            status.code().unwrap_or(-1)
        ));
    }

    Ok(())
}

/// Parse FFmpeg progress output.
/// Looks for `out_time_us=<microseconds>` or `time=HH:MM:SS.ms` patterns.
fn parse_ffmpeg_progress(line: &str, total_duration: f64) -> Option<f64> {
    if total_duration <= 0.0 {
        return None;
    }

    // Try out_time_us (from -progress pipe:2)
    if let Some(value) = line.strip_prefix("out_time_us=") {
        if let Ok(us) = value.trim().parse::<f64>() {
            let seconds = us / 1_000_000.0;
            return Some(seconds / total_duration);
        }
    }

    // Try time= pattern (from normal stderr)
    if let Some(pos) = line.find("time=") {
        let time_str = &line[pos + 5..];
        if let Some(end) = time_str.find(|c: char| c == ' ' || c == '\n' || c == '\r') {
            let time_part = &time_str[..end];
            if let Some(seconds) = parse_time_string(time_part) {
                return Some(seconds / total_duration);
            }
        } else if let Some(seconds) = parse_time_string(time_str.trim()) {
            return Some(seconds / total_duration);
        }
    }

    None
}

/// Parse a time string like "00:01:23.45" into seconds.
fn parse_time_string(time: &str) -> Option<f64> {
    let parts: Vec<&str> = time.split(':').collect();
    if parts.len() == 3 {
        let hours: f64 = parts[0].parse().ok()?;
        let minutes: f64 = parts[1].parse().ok()?;
        let seconds: f64 = parts[2].parse().ok()?;
        Some(hours * 3600.0 + minutes * 60.0 + seconds)
    } else {
        None
    }
}

/// Cancel a batch or single render process.
#[tauri::command]
pub async fn cancel_render(process_id: String) -> Result<(), String> {
    if let Ok(mut cancelled) = CANCELLED.lock() {
        cancelled.insert(process_id.clone());
    }
    // Clean up progress
    if let Ok(mut progress_map) = RENDER_PROGRESS.lock() {
        progress_map.remove(&process_id);
    }
    Ok(())
}

/// Batch render multiple videos with watermark overlays.
/// Emits BatchProgressEvent to the frontend via Tauri events.
#[tauri::command]
pub async fn batch_render_video(
    app_handle: tauri::AppHandle,
    items: Vec<BatchItemConfig>,
    watermarks: Vec<WatermarkConfig>,
    quality: String,
) -> Result<String, String> {
    use tauri::Emitter;

    let batch_id = format!(
        "batch_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let bid = batch_id.clone();
    let total_count = items.len();

    tokio::task::spawn(async move {
        for (index, item) in items.iter().enumerate() {
            // Check if cancelled
            if let Ok(cancelled) = CANCELLED.lock() {
                if cancelled.contains(&bid) {
                    break;
                }
            }

            // Emit "processing" event
            let _ = app_handle.emit(
                "batch-progress",
                BatchProgressEvent {
                    batch_id: bid.clone(),
                    current_index: index,
                    total_count,
                    file_progress: 0.0,
                    file_status: "processing".to_string(),
                    error_message: None,
                    batch_complete: false,
                },
            );

            // Probe the video
            let video_info = match probe_video_info(&item.input_path) {
                Ok(info) => info,
                Err(e) => {
                    let _ = app_handle.emit(
                        "batch-progress",
                        BatchProgressEvent {
                            batch_id: bid.clone(),
                            current_index: index,
                            total_count,
                            file_progress: 0.0,
                            file_status: "error".to_string(),
                            error_message: Some(e),
                            batch_complete: false,
                        },
                    );
                    continue;
                }
            };

            // Run FFmpeg render (blocking, in a spawn_blocking)
            let input = item.input_path.clone();
            let output = item.output_path.clone();
            let wms = watermarks.clone();
            let q = quality.clone();
            let bid_inner = bid.clone();
            let app_inner = app_handle.clone();
            let vw = video_info.width;
            let vh = video_info.height;
            let duration = video_info.duration;

            let result = tokio::task::spawn_blocking(move || {
                run_ffmpeg_render_with_callback(
                    &input,
                    &output,
                    &wms,
                    &q,
                    vw,
                    vh,
                    duration,
                    &bid_inner,
                    index,
                    total_count,
                    &app_inner,
                )
            })
            .await;

            match result {
                Ok(Ok(())) => {
                    let _ = app_handle.emit(
                        "batch-progress",
                        BatchProgressEvent {
                            batch_id: bid.clone(),
                            current_index: index,
                            total_count,
                            file_progress: 1.0,
                            file_status: "complete".to_string(),
                            error_message: None,
                            batch_complete: false,
                        },
                    );
                }
                Ok(Err(e)) => {
                    let _ = app_handle.emit(
                        "batch-progress",
                        BatchProgressEvent {
                            batch_id: bid.clone(),
                            current_index: index,
                            total_count,
                            file_progress: 0.0,
                            file_status: "error".to_string(),
                            error_message: Some(e),
                            batch_complete: false,
                        },
                    );
                }
                Err(e) => {
                    let _ = app_handle.emit(
                        "batch-progress",
                        BatchProgressEvent {
                            batch_id: bid.clone(),
                            current_index: index,
                            total_count,
                            file_progress: 0.0,
                            file_status: "error".to_string(),
                            error_message: Some(format!("Task error: {}", e)),
                            batch_complete: false,
                        },
                    );
                }
            }
        }

        // Emit batch complete
        let _ = app_handle.emit(
            "batch-progress",
            BatchProgressEvent {
                batch_id: bid.clone(),
                current_index: total_count.saturating_sub(1),
                total_count,
                file_progress: 1.0,
                file_status: "complete".to_string(),
                error_message: None,
                batch_complete: true,
            },
        );

        // Clean up cancel set
        if let Ok(mut cancelled) = CANCELLED.lock() {
            cancelled.remove(&bid);
        }
    });

    Ok(batch_id)
}

/// Run FFmpeg render with progress callback via Tauri events (for batch processing).
fn run_ffmpeg_render_with_callback(
    input: &str,
    output: &str,
    watermarks: &[WatermarkConfig],
    quality: &str,
    video_width: u32,
    video_height: u32,
    duration: f64,
    batch_id: &str,
    current_index: usize,
    total_count: usize,
    app_handle: &tauri::AppHandle,
) -> Result<(), String> {
    use tauri::Emitter;

    let (crf, preset) = quality_to_crf(quality);

    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());
    args.push("-i".to_string());
    args.push(input.to_string());

    let filter_result = build_filter_complex(watermarks, video_width, video_height);
    args.extend(filter_result.input_args);

    if !filter_result.filter_complex.is_empty() {
        args.push("-filter_complex".to_string());
        args.push(filter_result.filter_complex);
        args.push("-map".to_string());
        args.push(filter_result.output_label);
        args.push("-map".to_string());
        args.push("0:a?".to_string());
    }

    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-crf".to_string());
    args.push(crf.to_string());
    args.push("-preset".to_string());
    args.push(preset.to_string());
    args.push("-c:a".to_string());
    args.push("copy".to_string());
    args.push("-progress".to_string());
    args.push("pipe:2".to_string());
    args.push(output.to_string());

    log::info!("Batch FFmpeg: ffmpeg {}", args.join(" "));

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}. Is FFmpeg installed?", e))?;

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let bid = batch_id.to_string();

        for line in reader.lines() {
            // Check cancellation
            if let Ok(cancelled) = CANCELLED.lock() {
                if cancelled.contains(&bid) {
                    let _ = child.kill();
                    return Err("Cancelled".to_string());
                }
            }

            if let Ok(line) = line {
                if let Some(progress) = parse_ffmpeg_progress(&line, duration) {
                    let _ = app_handle.emit(
                        "batch-progress",
                        BatchProgressEvent {
                            batch_id: bid.clone(),
                            current_index,
                            total_count,
                            file_progress: progress.clamp(0.0, 0.99),
                            file_status: "processing".to_string(),
                            error_message: None,
                            batch_complete: false,
                        },
                    );
                }
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    if !status.success() {
        return Err(format!(
            "FFmpeg exited with status: {}",
            status.code().unwrap_or(-1)
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_time_string() {
        assert!((parse_time_string("00:01:30.50").unwrap() - 90.5).abs() < 0.01);
        assert!((parse_time_string("01:00:00.00").unwrap() - 3600.0).abs() < 0.01);
        assert!(parse_time_string("invalid").is_none());
    }

    #[test]
    fn test_parse_ffmpeg_progress_out_time_us() {
        let progress = parse_ffmpeg_progress("out_time_us=30000000", 60.0).unwrap();
        assert!((progress - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_parse_ffmpeg_progress_time() {
        let progress = parse_ffmpeg_progress("frame=100 time=00:00:30.00 speed=2x", 60.0).unwrap();
        assert!((progress - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_parse_ffmpeg_progress_zero_duration() {
        assert!(parse_ffmpeg_progress("out_time_us=30000000", 0.0).is_none());
    }
}
