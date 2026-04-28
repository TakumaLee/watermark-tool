use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use crate::ffmpeg::audio::{
    build_audio_filters, extract_waveform, AudioRenderConfig, WaveformPeaks,
};
use crate::ffmpeg::overlay::{build_filter_complex, quality_to_crf};
use crate::ffmpeg::probe::probe_video_info;
use crate::ffmpeg::text::{build_subtitles_filter, build_text_filter_chain, SubtitleRenderConfig, TextRenderConfig};
use crate::ffmpeg::WatermarkConfig;

use super::ffmpeg::{get_render_progress_map, parse_ffmpeg_progress_pub};

/// Extract waveform peaks from a video or audio file.
///
/// Returns a WaveformPeaks struct with normalized peak values (0-1).
#[tauri::command]
pub async fn extract_audio_waveform(
    path: String,
    num_peaks: Option<usize>,
) -> Result<WaveformPeaks, String> {
    let peaks_count = num_peaks.unwrap_or(800);

    tokio::task::spawn_blocking(move || extract_waveform(&path, peaks_count))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

/// Probe audio duration from a file.
#[tauri::command]
pub async fn probe_audio_duration(path: String) -> Result<f64, String> {
    tokio::task::spawn_blocking(move || {
        let output = Command::new(crate::ffmpeg::ffprobe_path())
            .args([
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                &path,
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .output()
            .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

        if !output.status.success() {
            return Err("ffprobe failed".to_string());
        }

        let json_str = String::from_utf8_lossy(&output.stdout);
        let json: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

        let duration = json["format"]["duration"]
            .as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .unwrap_or(0.0);

        Ok(duration)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Render video with full audio processing: volume, BGM, fade, + optional watermarks/text/subtitles.
///
/// This is the unified render command that handles all features together.
#[tauri::command]
pub async fn render_with_audio(
    input: String,
    output: String,
    watermarks: Vec<WatermarkConfig>,
    texts: Vec<TextRenderConfig>,
    subtitle: Option<SubtitleRenderConfig>,
    audio: AudioRenderConfig,
    quality: String,
) -> Result<String, String> {
    let video_info = probe_video_info(&input)?;

    let process_id = format!(
        "audio_render_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let pid = process_id.clone();
    let duration = video_info.duration;
    let vw = video_info.width;
    let vh = video_info.height;

    // Initialize progress tracking
    {
        let progress_map = get_render_progress_map();
        let mut map = progress_map.lock().map_err(|e| format!("Lock error: {}", e))?;
        map.insert(pid.clone(), 0.0);
    }

    let pid_clone = pid.clone();

    tokio::task::spawn_blocking(move || {
        let result = run_audio_render(
            &input, &output, &watermarks, &texts, subtitle.as_ref(),
            &audio, &quality, vw, vh, duration, &pid_clone,
        );

        let progress_map = get_render_progress_map();
        if let Ok(mut map) = progress_map.lock() {
            if result.is_ok() {
                map.insert(pid_clone.clone(), 1.0);
            } else {
                map.remove(&pid_clone);
            }
        }

        result
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(process_id)
}

/// Run the actual FFmpeg render with audio processing.
fn run_audio_render(
    input: &str,
    output: &str,
    watermarks: &[WatermarkConfig],
    texts: &[TextRenderConfig],
    subtitle: Option<&SubtitleRenderConfig>,
    audio_config: &AudioRenderConfig,
    quality: &str,
    video_width: u32,
    video_height: u32,
    duration: f64,
    process_id: &str,
) -> Result<(), String> {
    let (crf, preset) = quality_to_crf(quality);

    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());
    args.push("-i".to_string());
    args.push(input.to_string());

    // Build audio filters
    let audio_result = build_audio_filters(audio_config, duration);

    // Add BGM input files (these come AFTER the main input but BEFORE watermark inputs)
    args.extend(audio_result.input_args.clone());

    // Build watermark filter complex
    let filter_result = build_filter_complex(watermarks, video_width, video_height);
    args.extend(filter_result.input_args.clone());

    // Build text drawtext filters
    let text_filter = build_text_filter_chain(texts, video_width, video_height);

    // Build subtitle filter
    let mut temp_srt_path: Option<String> = None;
    let subtitle_filter = if let Some(sub) = subtitle {
        let temp_dir = std::env::temp_dir().to_string_lossy().to_string();
        let (path, filter) = build_subtitles_filter(sub, &temp_dir)?;
        temp_srt_path = Some(path);
        Some(filter)
    } else {
        None
    };

    // Determine if we need audio filter_complex vs. simple -af
    let has_video_filters = !filter_result.filter_complex.is_empty()
        || !text_filter.is_empty()
        || subtitle_filter.is_some();

    if audio_result.needs_audio_map {
        // Complex audio mixing (BGM present) — need to merge video and audio filter_complex
        let mut combined_filters: Vec<String> = Vec::new();

        // Video filter chain
        if !filter_result.filter_complex.is_empty() {
            combined_filters.push(filter_result.filter_complex.clone());

            // Apply text/subtitle on watermark output
            let mut post_filters: Vec<String> = Vec::new();
            if !text_filter.is_empty() {
                post_filters.push(text_filter);
            }
            if let Some(ref sub_f) = subtitle_filter {
                post_filters.push(sub_f.clone());
            }

            if !post_filters.is_empty() {
                let last = combined_filters.pop().unwrap();
                let last = last.replace("[vout]", "[wmout]");
                combined_filters.push(last);
                combined_filters.push(format!(
                    "[wmout]{}[vout]",
                    post_filters.join(","),
                ));
            }
        } else {
            // No watermark filters — create simple video pass-through with text/subs
            let mut vf_parts: Vec<String> = Vec::new();
            if !text_filter.is_empty() {
                vf_parts.push(text_filter);
            }
            if let Some(ref sub_f) = subtitle_filter {
                vf_parts.push(sub_f.clone());
            }
            if !vf_parts.is_empty() {
                combined_filters.push(format!("[0:v]{}[vout]", vf_parts.join(",")));
            }
        }

        // Audio filter chain (from build_audio_filters)
        // Extract the filter_complex string from audio args
        let audio_fc_idx = audio_result.filter_args.iter().position(|a| a == "-filter_complex");
        if let Some(idx) = audio_fc_idx {
            if idx + 1 < audio_result.filter_args.len() {
                let audio_fc = &audio_result.filter_args[idx + 1];
                combined_filters.push(audio_fc.clone());
            }
        }

        args.push("-filter_complex".to_string());
        args.push(combined_filters.join(";"));

        // Map video output
        if has_video_filters {
            args.push("-map".to_string());
            args.push("[vout]".to_string());
        } else {
            args.push("-map".to_string());
            args.push("0:v".to_string());
        }

        // Map audio output
        args.push("-map".to_string());
        args.push("[aout]".to_string());

    } else {
        // Simple audio (no BGM) — use standard video filter approach + -af
        // Video filters
        if !filter_result.filter_complex.is_empty() {
            let mut combined_filters: Vec<String> = Vec::new();
            combined_filters.push(filter_result.filter_complex.clone());

            let mut post_filters: Vec<String> = Vec::new();
            if !text_filter.is_empty() {
                post_filters.push(text_filter);
            }
            if let Some(ref sub_f) = subtitle_filter {
                post_filters.push(sub_f.clone());
            }

            if !post_filters.is_empty() {
                let last = combined_filters.pop().unwrap();
                let last = last.replace("[vout]", "[wmout]");
                combined_filters.push(last);
                combined_filters.push(format!(
                    "[wmout]{}[vout]",
                    post_filters.join(","),
                ));
            }

            args.push("-filter_complex".to_string());
            args.push(combined_filters.join(";"));
            args.push("-map".to_string());
            args.push("[vout]".to_string());
            args.push("-map".to_string());
            args.push("0:a?".to_string());
        } else {
            // No watermarks
            let mut vf_parts: Vec<String> = Vec::new();
            if !text_filter.is_empty() {
                vf_parts.push(text_filter);
            }
            if let Some(ref sub_f) = subtitle_filter {
                vf_parts.push(sub_f.clone());
            }
            if !vf_parts.is_empty() {
                args.push("-vf".to_string());
                args.push(vf_parts.join(","));
            }
        }

        // Audio filter (simple -af)
        if audio_result.filter_args.contains(&"-an".to_string()) {
            args.push("-an".to_string());
        } else if audio_result.filter_args.contains(&"-af".to_string()) {
            let af_idx = audio_result.filter_args.iter().position(|a| a == "-af").unwrap();
            args.push("-af".to_string());
            args.push(audio_result.filter_args[af_idx + 1].clone());
        }
    }

    // Encoding settings
    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-crf".to_string());
    args.push(crf.to_string());
    args.push("-preset".to_string());
    args.push(preset.to_string());

    // Audio codec (re-encode if we have audio filters, copy otherwise)
    if !audio_result.filter_args.is_empty() && !audio_result.filter_args.contains(&"-an".to_string()) {
        args.push("-c:a".to_string());
        args.push("aac".to_string());
        args.push("-b:a".to_string());
        args.push("192k".to_string());
    } else if !audio_result.filter_args.contains(&"-an".to_string()) {
        args.push("-c:a".to_string());
        args.push("copy".to_string());
    }

    // Progress output
    args.push("-progress".to_string());
    args.push("pipe:2".to_string());
    args.push(output.to_string());

    log::info!("Running FFmpeg (audio): ffmpeg {}", args.join(" "));

    let mut child = Command::new(crate::ffmpeg::ffmpeg_path())
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}. Is FFmpeg installed?", e))?;

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let pid = process_id.to_string();

        for line in reader.lines() {
            if let Ok(line) = line {
                if let Some(progress) = parse_ffmpeg_progress_pub(&line, duration) {
                    let progress_map = get_render_progress_map();
                    if let Ok(mut map) = progress_map.lock() {
                        map.insert(pid.clone(), progress.clamp(0.0, 0.99));
                    };
                }
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    // Clean up temp SRT file
    if let Some(path) = temp_srt_path {
        let _ = std::fs::remove_file(path);
    }

    if !status.success() {
        return Err(format!(
            "FFmpeg exited with status: {}",
            status.code().unwrap_or(-1)
        ));
    }

    Ok(())
}
