use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use crate::ffmpeg::overlay::{build_filter_complex, quality_to_crf};
use crate::ffmpeg::probe::probe_video_info;
use crate::ffmpeg::text::{build_subtitles_filter, build_text_filter_chain, SubtitleRenderConfig, TextRenderConfig};
use crate::ffmpeg::WatermarkConfig;

use super::ffmpeg::parse_ffmpeg_progress_pub;

/// Render video with text overlays, subtitles, and optional watermarks.
///
/// This is the unified render command that handles all overlay types.
#[tauri::command]
pub async fn render_with_text(
    input: String,
    output: String,
    watermarks: Vec<WatermarkConfig>,
    texts: Vec<TextRenderConfig>,
    subtitle: Option<SubtitleRenderConfig>,
    quality: String,
) -> Result<String, String> {
    let video_info = probe_video_info(&input)?;

    let process_id = format!(
        "text_render_{}",
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
        let progress_map = super::ffmpeg::get_render_progress_map();
        let mut map = progress_map.lock().map_err(|e| format!("Lock error: {}", e))?;
        map.insert(pid.clone(), 0.0);
    }

    let pid_clone = pid.clone();

    tokio::task::spawn_blocking(move || {
        let result = run_text_render(
            &input, &output, &watermarks, &texts, subtitle.as_ref(), &quality,
            vw, vh, duration, &pid_clone,
        );

        let progress_map = super::ffmpeg::get_render_progress_map();
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

/// Run FFmpeg with text overlays and subtitles.
fn run_text_render(
    input: &str,
    output: &str,
    watermarks: &[WatermarkConfig],
    texts: &[TextRenderConfig],
    subtitle: Option<&SubtitleRenderConfig>,
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

    // Combine all filters
    let mut combined_filters: Vec<String> = Vec::new();

    if !filter_result.filter_complex.is_empty() {
        // Watermark filters exist — chain text/subtitles after them
        combined_filters.push(filter_result.filter_complex);

        // After watermark chain, the output is [vout]
        // We need to apply text and subtitle filters to [vout]
        let mut post_filters: Vec<String> = Vec::new();
        if !text_filter.is_empty() {
            post_filters.push(text_filter);
        }
        if let Some(ref sub_f) = subtitle_filter {
            post_filters.push(sub_f.clone());
        }

        if !post_filters.is_empty() {
            // Rewrite: watermark output to [wmout], then apply text/subs
            let wm_chain = combined_filters.pop().unwrap();
            let wm_chain = wm_chain.replace("[vout]", "[wmout]");
            combined_filters.push(wm_chain);
            combined_filters.push(format!(
                "[wmout]{filter}[vout]",
                filter = post_filters.join(","),
            ));
        }

        args.push("-filter_complex".to_string());
        args.push(combined_filters.join(";"));
        args.push("-map".to_string());
        args.push("[vout]".to_string());
        args.push("-map".to_string());
        args.push("0:a?".to_string());
    } else {
        // No watermarks — use -vf for text and subtitle filters
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

    // Encoding settings
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

    log::info!("Running FFmpeg (text): ffmpeg {}", args.join(" "));

    let mut child = Command::new("ffmpeg")
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
                    let progress_map = super::ffmpeg::get_render_progress_map();
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
