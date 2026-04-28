use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use crate::ffmpeg::export::{
    build_duration_args, build_gif_palettegen_filter, build_gif_paletteuse_filter,
    build_gif_time_args, build_scale_pad_filter, build_thumbnail_args,
    estimate_gif_size, platform_quality_to_params, GifExportConfig, PlatformExportConfig,
    ThumbnailConfig,
};
use crate::ffmpeg::probe::probe_video_info;

use super::ffmpeg::{get_render_progress_map, parse_ffmpeg_progress_pub};

/// Export video with platform preset (scale + pad/crop + quality + duration limit).
#[tauri::command]
pub async fn export_platform_video(
    input: String,
    output: String,
    config: PlatformExportConfig,
) -> Result<String, String> {
    let video_info = probe_video_info(&input)?;

    let process_id = format!(
        "platform_export_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let pid = process_id.clone();
    let duration = video_info.duration;

    {
        let progress_map = get_render_progress_map();
        let mut map = progress_map
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        map.insert(pid.clone(), 0.0);
    }

    let pid_clone = pid.clone();

    tokio::task::spawn_blocking(move || {
        let result =
            run_platform_export(&input, &output, &config, duration, &pid_clone);

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

/// Export video as GIF using two-pass palette method.
#[tauri::command]
pub async fn export_gif(
    input: String,
    output: String,
    config: GifExportConfig,
) -> Result<String, String> {
    let video_info = probe_video_info(&input)?;

    let process_id = format!(
        "gif_export_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let pid = process_id.clone();
    let duration = video_info.duration;

    {
        let progress_map = get_render_progress_map();
        let mut map = progress_map
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        map.insert(pid.clone(), 0.0);
    }

    let pid_clone = pid.clone();

    tokio::task::spawn_blocking(move || {
        let result = run_gif_export(&input, &output, &config, duration, &pid_clone);

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

/// Extract a thumbnail (single frame) from the video.
#[tauri::command]
pub async fn extract_thumbnail(
    input: String,
    output: String,
    config: ThumbnailConfig,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let args = build_thumbnail_args(&input, &output, config.time, &config.format, config.quality);

        log::info!("Running FFmpeg (thumbnail): ffmpeg {}", args.join(" "));

        let child = Command::new(crate::ffmpeg::ffmpeg_path())
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("Failed to spawn ffmpeg: {}. Is FFmpeg installed?", e))?;

        if !child.status.success() {
            let stderr = String::from_utf8_lossy(&child.stderr);
            return Err(format!("FFmpeg thumbnail failed: {}", stderr));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Estimate GIF file size.
#[tauri::command]
pub async fn estimate_gif_file_size(
    input: String,
    config: GifExportConfig,
) -> Result<u64, String> {
    let video_info = probe_video_info(&input)?;
    let end = if config.end_time < 0.0 {
        video_info.duration
    } else {
        config.end_time
    };
    let gif_duration = (end - config.start_time).max(0.0);
    Ok(estimate_gif_size(
        config.width,
        config.fps,
        gif_duration,
        config.colors,
    ))
}

fn run_platform_export(
    input: &str,
    output: &str,
    config: &PlatformExportConfig,
    duration: f64,
    process_id: &str,
) -> Result<(), String> {
    let (crf, preset) = platform_quality_to_params(&config.quality);
    let scale_filter = build_scale_pad_filter(config.width, config.height, &config.aspect_mode);
    let duration_args = build_duration_args(config.max_duration);

    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());
    args.push("-i".to_string());
    args.push(input.to_string());

    // Duration limit (before encoding for efficiency)
    args.extend(duration_args);

    // Video filter for scale+pad/crop
    args.push("-vf".to_string());
    args.push(scale_filter);

    // Encoding settings
    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-crf".to_string());
    args.push(crf.to_string());
    args.push("-preset".to_string());
    args.push(preset.to_string());

    // Audio
    args.push("-c:a".to_string());
    args.push("aac".to_string());
    args.push("-b:a".to_string());
    args.push("192k".to_string());

    // Progress
    args.push("-progress".to_string());
    args.push("pipe:2".to_string());

    args.push(output.to_string());

    log::info!("Running FFmpeg (platform export): ffmpeg {}", args.join(" "));

    let effective_duration = if config.max_duration > 0.0 {
        config.max_duration.min(duration)
    } else {
        duration
    };

    run_ffmpeg_with_progress_tracking(&args, effective_duration, process_id)
}

fn run_gif_export(
    input: &str,
    output: &str,
    config: &GifExportConfig,
    duration: f64,
    process_id: &str,
) -> Result<(), String> {
    let time_args = build_gif_time_args(config.start_time, config.end_time, duration);

    // Step 1: Generate palette (50% of total progress)
    let palette_path = format!("{}.palette.png", output);

    let palettegen_filter = build_gif_palettegen_filter(config.width, config.fps);

    let mut pass1_args: Vec<String> = Vec::new();
    pass1_args.push("-y".to_string());
    pass1_args.extend(time_args.clone());
    pass1_args.push("-i".to_string());
    pass1_args.push(input.to_string());
    pass1_args.push("-vf".to_string());
    pass1_args.push(palettegen_filter);
    pass1_args.push(palette_path.clone());

    log::info!("Running FFmpeg (GIF pass 1): ffmpeg {}", pass1_args.join(" "));

    // Run pass 1 (palette generation — quick, just set 10% progress)
    let child = Command::new(crate::ffmpeg::ffmpeg_path())
        .args(&pass1_args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("Failed to spawn ffmpeg (palette): {}", e))?;

    if !child.status.success() {
        let stderr = String::from_utf8_lossy(&child.stderr);
        return Err(format!("GIF palette generation failed: {}", stderr));
    }

    // Update progress to 10%
    {
        let pm = get_render_progress_map();
        let mut map = pm.lock().map_err(|e| format!("Lock error: {}", e))?;
        map.insert(process_id.to_string(), 0.1);
    }

    // Step 2: Generate GIF with palette (remaining 90% of progress)
    let paletteuse_filter = build_gif_paletteuse_filter(config.width, config.fps, config.colors);

    let mut pass2_args: Vec<String> = Vec::new();
    pass2_args.push("-y".to_string());
    pass2_args.extend(time_args);
    pass2_args.push("-i".to_string());
    pass2_args.push(input.to_string());
    pass2_args.push("-i".to_string());
    pass2_args.push(palette_path.clone());
    pass2_args.push("-lavfi".to_string());
    pass2_args.push(paletteuse_filter);
    pass2_args.push("-progress".to_string());
    pass2_args.push("pipe:2".to_string());
    pass2_args.push(output.to_string());

    log::info!("Running FFmpeg (GIF pass 2): ffmpeg {}", pass2_args.join(" "));

    let end_time = if config.end_time < 0.0 {
        duration
    } else {
        config.end_time
    };
    let gif_duration = (end_time - config.start_time).max(1.0);

    // Run pass 2 with progress tracking
    let mut child = Command::new(crate::ffmpeg::ffmpeg_path())
        .args(&pass2_args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg (gif): {}", e))?;

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let pid = process_id.to_string();

        for line in reader.lines() {
            if let Ok(line) = line {
                if let Some(progress) = parse_ffmpeg_progress_pub(&line, gif_duration) {
                    // Scale pass2 progress to 10%-99%
                    let scaled = 0.1 + progress * 0.89;
                    let pm = get_render_progress_map();
                    if let Ok(mut map) = pm.lock() {
                        map.insert(pid.clone(), scaled.clamp(0.1, 0.99));
                    };
                }
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    // Clean up palette file
    let _ = std::fs::remove_file(&palette_path);

    if !status.success() {
        return Err(format!(
            "FFmpeg GIF export failed with status: {}",
            status.code().unwrap_or(-1)
        ));
    }

    Ok(())
}

/// Helper: spawn ffmpeg and track progress.
fn run_ffmpeg_with_progress_tracking(
    args: &[String],
    total_duration: f64,
    process_id: &str,
) -> Result<(), String> {
    let mut child = Command::new(crate::ffmpeg::ffmpeg_path())
        .args(args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}. Is FFmpeg installed?", e))?;

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        let pid = process_id.to_string();

        for line in reader.lines() {
            if let Ok(line) = line {
                if let Some(progress) = parse_ffmpeg_progress_pub(&line, total_duration) {
                    let pm = get_render_progress_map();
                    if let Ok(mut map) = pm.lock() {
                        map.insert(pid.clone(), progress.clamp(0.0, 0.99));
                    };
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
