use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use crate::ffmpeg::ai::{
    build_scene_detect_args, build_silence_detect_args, parse_scene_detect_output,
    parse_silence_detect_output, parse_srt_output, build_chromakey_filter, build_enhancement_filters,
    ChromakeyConfig, EnhancementConfig, ScenePoint, SilenceSegment, WhisperEntry,
};

use super::ffmpeg::{get_render_progress_map, parse_ffmpeg_progress_pub};

/// Check if whisper CLI is available on the system
#[tauri::command]
pub async fn check_whisper_available() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        // Try whisper (Python)
        if Command::new("whisper")
            .arg("--help")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
        {
            return Ok(true);
        }
        // Try whisper.cpp main binary
        if Command::new("whisper-cpp")
            .arg("--help")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
        {
            return Ok(true);
        }
        Ok(false)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Run Whisper transcription on a video/audio file.
/// Returns parsed SRT entries.
#[tauri::command]
pub async fn whisper_transcribe(
    input: String,
    language: String,
    model: String,
) -> Result<Vec<WhisperEntry>, String> {
    tokio::task::spawn_blocking(move || {
        // First extract audio to a temp WAV file
        let temp_dir = std::env::temp_dir();
        let temp_wav = temp_dir
            .join(format!("whisper_input_{}.wav", std::process::id()))
            .to_string_lossy()
            .to_string();

        // Extract audio using FFmpeg
        let extract_status = Command::new("ffmpeg")
            .args([
                "-y",
                "-i",
                &input,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                &temp_wav,
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .map_err(|e| format!("Failed to extract audio: {}", e))?;

        if !extract_status.success() {
            return Err("Failed to extract audio from video".to_string());
        }

        // Run whisper
        let temp_output_dir = temp_dir
            .join(format!("whisper_output_{}", std::process::id()))
            .to_string_lossy()
            .to_string();

        // Create output directory
        let _ = std::fs::create_dir_all(&temp_output_dir);

        let mut whisper_args = vec![
            "--model".to_string(),
            model.clone(),
            "--output_format".to_string(),
            "srt".to_string(),
            "--output_dir".to_string(),
            temp_output_dir.clone(),
        ];

        if language != "auto" {
            whisper_args.push("--language".to_string());
            whisper_args.push(language.clone());
        }

        whisper_args.push(temp_wav.clone());

        log::info!("Running whisper: whisper {}", whisper_args.join(" "));

        let whisper_output = Command::new("whisper")
            .args(&whisper_args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("Failed to run whisper: {}. Is whisper installed?", e))?;

        if !whisper_output.status.success() {
            let stderr = String::from_utf8_lossy(&whisper_output.stderr);
            // Clean up
            let _ = std::fs::remove_file(&temp_wav);
            let _ = std::fs::remove_dir_all(&temp_output_dir);
            return Err(format!("Whisper failed: {}", stderr));
        }

        // Read the SRT output file
        let wav_stem = std::path::Path::new(&temp_wav)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let srt_path = format!("{}/{}.srt", temp_output_dir, wav_stem);

        let srt_content = std::fs::read_to_string(&srt_path).map_err(|e| {
            // Clean up
            let _ = std::fs::remove_file(&temp_wav);
            let _ = std::fs::remove_dir_all(&temp_output_dir);
            format!("Failed to read whisper output: {}", e)
        })?;

        let entries = parse_srt_output(&srt_content);

        // Clean up temp files
        let _ = std::fs::remove_file(&temp_wav);
        let _ = std::fs::remove_dir_all(&temp_output_dir);

        Ok(entries)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Run scene detection on a video file.
/// Returns detected scene change points.
#[tauri::command]
pub async fn detect_scenes(input: String, threshold: f64) -> Result<Vec<ScenePoint>, String> {
    tokio::task::spawn_blocking(move || {
        let args = build_scene_detect_args(&input, threshold);

        log::info!("Running scene detection: ffmpeg {}", args.join(" "));

        let output = Command::new("ffmpeg")
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

        let stderr = String::from_utf8_lossy(&output.stderr);
        let points = parse_scene_detect_output(&stderr, threshold);

        Ok(points)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Run silence detection on a video/audio file.
/// Returns detected silence segments.
#[tauri::command]
pub async fn detect_silence(
    input: String,
    noise_db: f64,
    min_duration: f64,
) -> Result<Vec<SilenceSegment>, String> {
    tokio::task::spawn_blocking(move || {
        let args = build_silence_detect_args(&input, noise_db, min_duration);

        log::info!("Running silence detection: ffmpeg {}", args.join(" "));

        let output = Command::new("ffmpeg")
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .output()
            .map_err(|e| format!("Failed to run FFmpeg: {}", e))?;

        let stderr = String::from_utf8_lossy(&output.stderr);
        let segments = parse_silence_detect_output(&stderr);

        Ok(segments)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

/// Apply enhancement filters to a video and render output.
#[tauri::command]
pub async fn render_with_enhancement(
    input: String,
    output: String,
    enhancement: EnhancementConfig,
    chromakey: Option<ChromakeyConfig>,
    quality: String,
) -> Result<String, String> {
    use crate::ffmpeg::overlay::quality_to_crf;
    use crate::ffmpeg::probe::probe_video_info;

    let video_info = probe_video_info(&input)?;

    let process_id = format!(
        "ai_render_{}",
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
        let (crf, preset) = quality_to_crf(&quality);
        let mut args: Vec<String> = Vec::new();
        args.push("-y".to_string());
        args.push("-i".to_string());
        args.push(input.to_string());

        // Build video filter chain
        let mut vf_parts: Vec<String> = Vec::new();

        // Chromakey first
        if let Some(ref ck) = chromakey {
            vf_parts.push(build_chromakey_filter(ck));
        }

        // Enhancement filters
        let enh_filter = build_enhancement_filters(&enhancement);
        if !enh_filter.is_empty() {
            vf_parts.push(enh_filter);
        }

        if !vf_parts.is_empty() {
            args.push("-vf".to_string());
            args.push(vf_parts.join(","));
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

        log::info!("Running FFmpeg (AI enhancement): ffmpeg {}", args.join(" "));

        let mut child = Command::new("ffmpeg")
            .args(&args)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn ffmpeg: {}", e))?;

        if let Some(stderr) = child.stderr.take() {
            let reader = BufReader::new(stderr);
            let p = pid_clone.clone();

            for line in reader.lines() {
                if let Ok(line) = line {
                    if let Some(progress) = parse_ffmpeg_progress_pub(&line, duration) {
                        let pm = get_render_progress_map();
                        if let Ok(mut map) = pm.lock() {
                            map.insert(p.clone(), progress.clamp(0.0, 0.99));
                        };
                    }
                }
            }
        }

        let status = child
            .wait()
            .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

        let progress_map = get_render_progress_map();
        if let Ok(mut map) = progress_map.lock() {
            if status.success() {
                map.insert(pid_clone.clone(), 1.0);
            } else {
                map.remove(&pid_clone);
            }
        }

        if !status.success() {
            return Err(format!(
                "FFmpeg exited with status: {}",
                status.code().unwrap_or(-1)
            ));
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(process_id)
}
