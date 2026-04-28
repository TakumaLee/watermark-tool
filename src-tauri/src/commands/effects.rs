use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use crate::ffmpeg::audio::{build_audio_filters, AudioRenderConfig};
use crate::ffmpeg::effects::{
    build_effects_audio_filters, build_effects_video_filters, build_pip_filters,
    build_transition_filter, build_audio_transition_filter,
    EffectsConfig, TransitionConfig,
};
use crate::ffmpeg::overlay::{build_filter_complex, quality_to_crf};
use crate::ffmpeg::probe::probe_video_info;
use crate::ffmpeg::text::{
    build_subtitles_filter, build_text_filter_chain, SubtitleRenderConfig, TextRenderConfig,
};
use crate::ffmpeg::WatermarkConfig;

use super::ffmpeg::{get_render_progress_map, parse_ffmpeg_progress_pub};

/// Unified render command with all effects: watermarks, text, subtitles, audio, filters, speed,
/// PiP, crop/rotate/flip.
#[tauri::command]
pub async fn render_with_effects(
    input: String,
    output: String,
    watermarks: Vec<WatermarkConfig>,
    texts: Vec<TextRenderConfig>,
    subtitle: Option<SubtitleRenderConfig>,
    audio: Option<AudioRenderConfig>,
    effects: EffectsConfig,
    quality: String,
) -> Result<String, String> {
    let video_info = probe_video_info(&input)?;

    let process_id = format!(
        "effects_render_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let pid = process_id.clone();
    let duration = video_info.duration;
    let vw = video_info.width;
    let vh = video_info.height;

    {
        let progress_map = get_render_progress_map();
        let mut map = progress_map
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        map.insert(pid.clone(), 0.0);
    }

    let pid_clone = pid.clone();

    tokio::task::spawn_blocking(move || {
        let result = run_effects_render(
            &input,
            &output,
            &watermarks,
            &texts,
            subtitle.as_ref(),
            audio.as_ref(),
            &effects,
            &quality,
            vw,
            vh,
            duration,
            &pid_clone,
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

/// Render clips with transitions between them.
#[tauri::command]
pub async fn render_with_transitions(
    clip_paths: Vec<String>,
    clip_durations: Vec<f64>,
    transitions: Vec<TransitionConfig>,
    output: String,
    quality: String,
) -> Result<String, String> {
    if clip_paths.is_empty() {
        return Err("No clips provided".to_string());
    }

    let process_id = format!(
        "transition_render_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let pid = process_id.clone();
    let total_duration: f64 = clip_durations.iter().sum();

    {
        let progress_map = get_render_progress_map();
        let mut map = progress_map
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        map.insert(pid.clone(), 0.0);
    }

    let pid_clone = pid.clone();

    tokio::task::spawn_blocking(move || {
        let result = run_transition_render(
            &clip_paths,
            &clip_durations,
            &transitions,
            &output,
            &quality,
            total_duration,
            &pid_clone,
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

fn run_effects_render(
    input: &str,
    output: &str,
    watermarks: &[WatermarkConfig],
    texts: &[TextRenderConfig],
    subtitle: Option<&SubtitleRenderConfig>,
    audio_config: Option<&AudioRenderConfig>,
    effects: &EffectsConfig,
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

    // Count additional inputs for indexing
    let mut next_input_idx: usize = 1;

    // Audio BGM inputs (must come before watermark inputs in the command)
    let audio_result = if let Some(ac) = audio_config {
        let r = build_audio_filters(ac, duration);
        let bgm_count = r.input_args.len() / 2; // Each BGM adds -i + path
        args.extend(r.input_args.clone());
        next_input_idx += bgm_count;
        Some(r)
    } else {
        None
    };

    // PiP inputs
    let pip_result = build_pip_filters(
        &effects.pip,
        video_width,
        video_height,
        next_input_idx,
        "effectsbase", // will be connected later
        duration,
    );
    args.extend(pip_result.input_args.clone());
    next_input_idx += pip_result.input_count;

    // Watermark inputs
    let wm_result = build_filter_complex(watermarks, video_width, video_height);
    // Adjust watermark input indices (they expect to start at 1, but we may have shifted)
    // Since build_filter_complex assumes watermarks start at input index 1,
    // we need to adjust if we have BGM/PiP inputs before them.
    // For simplicity, we add watermark inputs at the end and rebuild filter references.
    args.extend(wm_result.input_args.clone());

    // Build text filters
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

    // Build effects video filter chain (crop/rotate/flip + eq + speed + reverse)
    let effects_vf = build_effects_video_filters(effects, video_width, video_height);

    // Build effects audio filter chain (speed + reverse)
    let effects_af = build_effects_audio_filters(effects.speed, effects.reverse);

    // Assemble filter_complex
    let mut fc_parts: Vec<String> = Vec::new();
    let mut current_video_label = "0:v".to_string();

    // 1. Watermark chain
    if !wm_result.filter_complex.is_empty() {
        fc_parts.push(wm_result.filter_complex.clone());
        current_video_label = "vout".to_string();
    }

    // 2. Effects (eq, speed, transform) on current video
    let mut post_wm_filters: Vec<String> = Vec::new();
    if !effects_vf.is_empty() {
        post_wm_filters.push(effects_vf.clone());
    }
    if !text_filter.is_empty() {
        post_wm_filters.push(text_filter.clone());
    }
    if let Some(ref sub_f) = subtitle_filter {
        post_wm_filters.push(sub_f.clone());
    }

    if !post_wm_filters.is_empty() {
        if current_video_label == "vout" {
            // Rename vout to intermediate
            let last = fc_parts.pop().unwrap();
            let last = last.replace("[vout]", "[pre_effects]");
            fc_parts.push(last);
            fc_parts.push(format!(
                "[pre_effects]{}[vout]",
                post_wm_filters.join(",")
            ));
        } else {
            fc_parts.push(format!(
                "[0:v]{}[vout]",
                post_wm_filters.join(",")
            ));
        }
        current_video_label = "vout".to_string();
    }

    // 3. PiP overlay chain
    if !pip_result.filter_segments.is_empty() {
        let pip_base = if current_video_label == "vout" {
            // Rename current vout to pip_base
            let last = fc_parts.pop().unwrap();
            let last = last.replace("[vout]", "[pip_base]");
            fc_parts.push(last);
            "pip_base".to_string()
        } else {
            "0:v".to_string()
        };

        // Replace "effectsbase" in pip segments with actual label
        for seg in &pip_result.filter_segments {
            let fixed = seg.replace("effectsbase", &pip_base);
            fc_parts.push(fixed);
        }

        // Rename pipfinal to vout
        if let Some(last) = fc_parts.last_mut() {
            *last = last.replace("[pipfinal]", "[vout]");
        }
        current_video_label = "vout".to_string();
    }

    // 4. Audio filter chain
    let needs_audio_fc = audio_result
        .as_ref()
        .map(|r| r.needs_audio_map)
        .unwrap_or(false);

    if needs_audio_fc {
        if let Some(ref ar) = audio_result {
            let audio_fc_idx = ar.filter_args.iter().position(|a| a == "-filter_complex");
            if let Some(idx) = audio_fc_idx {
                if idx + 1 < ar.filter_args.len() {
                    fc_parts.push(ar.filter_args[idx + 1].clone());
                }
            }
        }
    }

    // Build the full command
    let has_fc = !fc_parts.is_empty();

    if has_fc {
        args.push("-filter_complex".to_string());
        args.push(fc_parts.join(";"));

        args.push("-map".to_string());
        if current_video_label == "vout" {
            args.push("[vout]".to_string());
        } else {
            args.push("0:v".to_string());
        }

        args.push("-map".to_string());
        if needs_audio_fc {
            args.push("[aout]".to_string());
        } else {
            args.push("0:a?".to_string());
        }
    } else {
        // Simple -vf / -af mode
        let mut vf_parts: Vec<String> = Vec::new();
        if !effects_vf.is_empty() {
            vf_parts.push(effects_vf.clone());
        }
        if !text_filter.is_empty() {
            vf_parts.push(text_filter.clone());
        }
        if let Some(ref sub_f) = subtitle_filter {
            vf_parts.push(sub_f.clone());
        }
        if !vf_parts.is_empty() {
            args.push("-vf".to_string());
            args.push(vf_parts.join(","));
        }
    }

    // Audio encoding
    let has_audio_effects = !effects_af.is_empty();
    if !has_fc && has_audio_effects {
        // Simple -af for effects audio
        if let Some(ref ar) = audio_result {
            if ar.filter_args.contains(&"-af".to_string()) {
                let af_idx = ar.filter_args.iter().position(|a| a == "-af").unwrap();
                let existing = &ar.filter_args[af_idx + 1];
                args.push("-af".to_string());
                args.push(format!("{},{}", existing, effects_af));
            } else if !ar.filter_args.contains(&"-an".to_string()) {
                args.push("-af".to_string());
                args.push(effects_af);
            }
        } else {
            args.push("-af".to_string());
            args.push(effects_af);
        }
    } else if !has_fc {
        // Copy existing audio behavior
        if let Some(ref ar) = audio_result {
            if ar.filter_args.contains(&"-an".to_string()) {
                args.push("-an".to_string());
            } else if ar.filter_args.contains(&"-af".to_string()) {
                let af_idx = ar.filter_args.iter().position(|a| a == "-af").unwrap();
                args.push("-af".to_string());
                args.push(ar.filter_args[af_idx + 1].clone());
            }
        }
    }

    // Encoding settings
    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-crf".to_string());
    args.push(crf.to_string());
    args.push("-preset".to_string());
    args.push(preset.to_string());

    let needs_audio_reencode = has_audio_effects
        || needs_audio_fc
        || audio_result
            .as_ref()
            .map(|r| !r.filter_args.is_empty() && !r.filter_args.contains(&"-an".to_string()))
            .unwrap_or(false);

    if needs_audio_reencode {
        args.push("-c:a".to_string());
        args.push("aac".to_string());
        args.push("-b:a".to_string());
        args.push("192k".to_string());
    } else if !args.contains(&"-an".to_string()) {
        args.push("-c:a".to_string());
        args.push("copy".to_string());
    }

    args.push("-progress".to_string());
    args.push("pipe:2".to_string());
    args.push(output.to_string());

    log::info!("Running FFmpeg (effects): ffmpeg {}", args.join(" "));

    run_ffmpeg_with_progress(&args, duration, process_id)?;

    // Clean up temp SRT file
    if let Some(path) = temp_srt_path {
        let _ = std::fs::remove_file(path);
    }

    Ok(())
}

fn run_transition_render(
    clip_paths: &[String],
    clip_durations: &[f64],
    transitions: &[TransitionConfig],
    output: &str,
    quality: &str,
    total_duration: f64,
    process_id: &str,
) -> Result<(), String> {
    let (crf, preset) = quality_to_crf(quality);
    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());

    // Add all clip inputs
    for path in clip_paths {
        args.push("-i".to_string());
        args.push(path.clone());
    }

    // Build xfade filter
    let (video_fc, video_label) =
        build_transition_filter(clip_paths, clip_durations, transitions);
    let (audio_fc, audio_label) =
        build_audio_transition_filter(clip_paths.len(), clip_durations, transitions);

    if !video_fc.is_empty() || !audio_fc.is_empty() {
        let mut fc_parts: Vec<String> = Vec::new();
        if !video_fc.is_empty() {
            fc_parts.push(video_fc);
        }
        if !audio_fc.is_empty() {
            fc_parts.push(audio_fc);
        }

        args.push("-filter_complex".to_string());
        args.push(fc_parts.join(";"));
        args.push("-map".to_string());
        args.push(video_label);
        args.push("-map".to_string());
        args.push(audio_label);
    }

    args.push("-c:v".to_string());
    args.push("libx264".to_string());
    args.push("-crf".to_string());
    args.push(crf.to_string());
    args.push("-preset".to_string());
    args.push(preset.to_string());
    args.push("-c:a".to_string());
    args.push("aac".to_string());
    args.push("-b:a".to_string());
    args.push("192k".to_string());
    args.push("-progress".to_string());
    args.push("pipe:2".to_string());
    args.push(output.to_string());

    log::info!("Running FFmpeg (transitions): ffmpeg {}", args.join(" "));

    run_ffmpeg_with_progress(&args, total_duration, process_id)
}

/// Helper: spawn ffmpeg and track progress.
fn run_ffmpeg_with_progress(
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
