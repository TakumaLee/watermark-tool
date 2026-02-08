use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

use crate::ffmpeg::ai::{
    build_scene_detect_args, build_silence_detect_args, parse_scene_detect_output,
    parse_silence_detect_output, parse_srt_output, build_chromakey_filter, build_enhancement_filters,
    build_extract_frames_args, build_reassemble_frames_args,
    ChromakeyConfig, EnhancementConfig, ScenePoint, SilenceSegment, WhisperEntry,
    WatermarkRegion, WatermarkRemovalConfig,
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

/// Check if IOPaint (or lama-cleaner) CLI is available on the system
#[tauri::command]
pub async fn check_iopaint_available() -> Result<bool, String> {
    tokio::task::spawn_blocking(|| {
        // Try iopaint
        if Command::new("iopaint")
            .arg("--help")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .is_ok()
        {
            return Ok(true);
        }
        // Try lama-cleaner (older name)
        if Command::new("lama-cleaner")
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

/// Remove watermark from a video using AI inpainting (IOPaint/LaMa).
///
/// Flow:
/// 1. Extract frames from video using FFmpeg
/// 2. Generate mask PNG using Python script
/// 3. Run IOPaint on all frames (or fallback to OpenCV inpainting)
/// 4. Reassemble frames into video with original audio
/// 5. Cleanup temp files
///
/// Returns a process_id for progress tracking.
#[tauri::command]
pub async fn remove_watermark(
    input: String,
    output: String,
    mask_x: u32,
    mask_y: u32,
    mask_width: u32,
    mask_height: u32,
    quality: String,
) -> Result<String, String> {
    use crate::ffmpeg::overlay::quality_to_crf;
    use crate::ffmpeg::probe::probe_video_info;

    let video_info = probe_video_info(&input)?;

    let process_id = format!(
        "wm_remove_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let pid = process_id.clone();

    // Initialize progress
    {
        let progress_map = get_render_progress_map();
        let mut map = progress_map
            .lock()
            .map_err(|e| format!("Lock error: {}", e))?;
        map.insert(pid.clone(), 0.0);
    }

    let config = WatermarkRemovalConfig {
        regions: vec![WatermarkRegion {
            x: mask_x,
            y: mask_y,
            width: mask_width,
            height: mask_height,
        }],
        model: "lama".to_string(),
        device: "cpu".to_string(),
    };

    let fps = video_info.fps;
    let vid_width = video_info.width;
    let vid_height = video_info.height;
    let pid_clone = pid.clone();

    tokio::task::spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            // Create temp directories
            let temp_base = std::env::temp_dir().join(format!("wm_remove_{}", std::process::id()));
            let frames_dir = temp_base.join("frames");
            let output_frames_dir = temp_base.join("output_frames");
            let mask_path = temp_base.join("mask.png");

            std::fs::create_dir_all(&frames_dir)
                .map_err(|e| format!("Failed to create frames dir: {}", e))?;
            std::fs::create_dir_all(&output_frames_dir)
                .map_err(|e| format!("Failed to create output frames dir: {}", e))?;

            // === Step 1: Extract frames (0-10%) ===
            let frame_pattern = frames_dir.join("frame_%05d.png");
            let extract_args = build_extract_frames_args(
                &input,
                &frame_pattern.to_string_lossy(),
            );

            log::info!("Extracting frames: ffmpeg {}", extract_args.join(" "));

            let extract_status = Command::new("ffmpeg")
                .arg("-y")
                .args(&extract_args)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map_err(|e| format!("Failed to run FFmpeg for frame extraction: {}", e))?;

            if !extract_status.success() {
                return Err("FFmpeg frame extraction failed".to_string());
            }

            // Update progress to 10%
            if let Ok(mut map) = get_render_progress_map().lock() {
                map.insert(pid_clone.clone(), 0.10);
            }

            // Count extracted frames
            let frame_count = std::fs::read_dir(&frames_dir)
                .map_err(|e| format!("Failed to read frames dir: {}", e))?
                .filter(|e| {
                    e.as_ref()
                        .map(|e| e.path().extension().map(|ext| ext == "png").unwrap_or(false))
                        .unwrap_or(false)
                })
                .count();

            if frame_count == 0 {
                let _ = std::fs::remove_dir_all(&temp_base);
                return Err("No frames extracted".to_string());
            }

            // === Step 2: Generate mask ===
            let script_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("scripts");
            let mask_script = script_dir.join("generate_mask.py");

            let mask_args = config.build_mask_args(
                vid_width,
                vid_height,
                &mask_path.to_string_lossy(),
            );

            log::info!("Generating mask: python3 {} {}", mask_script.display(), mask_args.join(" "));

            let mask_status = Command::new("python3")
                .arg(&mask_script)
                .args(&mask_args)
                .stdout(Stdio::null())
                .stderr(Stdio::piped())
                .status()
                .map_err(|e| format!("Failed to run mask generation script: {}", e))?;

            if !mask_status.success() {
                let _ = std::fs::remove_dir_all(&temp_base);
                return Err("Mask generation failed".to_string());
            }

            // === Step 3: Inpaint frames (10-90%) ===
            let iopaint_available = Command::new("iopaint")
                .arg("--help")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map(|s| s.success())
                .unwrap_or(false);

            if iopaint_available {
                // Use IOPaint CLI
                let iopaint_args = config.build_iopaint_args(
                    &frames_dir.to_string_lossy(),
                    &mask_path.to_string_lossy(),
                    &output_frames_dir.to_string_lossy(),
                );

                log::info!("Running IOPaint: iopaint {}", iopaint_args.join(" "));

                let iopaint_child = Command::new("iopaint")
                    .args(&iopaint_args)
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .spawn()
                    .map_err(|e| format!("Failed to spawn iopaint: {}", e))?;

                // Monitor output frames for progress
                let iopaint_output = iopaint_child
                    .wait_with_output()
                    .map_err(|e| format!("IOPaint process error: {}", e))?;

                if !iopaint_output.status.success() {
                    let stderr = String::from_utf8_lossy(&iopaint_output.stderr);
                    let _ = std::fs::remove_dir_all(&temp_base);
                    return Err(format!("IOPaint failed: {}", stderr));
                }
            } else {
                // Fallback: OpenCV inpainting via Python
                log::warn!("IOPaint not available, falling back to OpenCV inpainting");

                let fallback_script = script_dir.join("generate_mask.py");
                // Use generate_mask.py with --inpaint flag for OpenCV fallback
                let fallback_status = Command::new("python3")
                    .arg(&fallback_script)
                    .arg("--inpaint")
                    .arg("--input-dir")
                    .arg(&frames_dir)
                    .arg("--output-dir")
                    .arg(&output_frames_dir)
                    .arg("--width")
                    .arg(vid_width.to_string())
                    .arg("--height")
                    .arg(vid_height.to_string())
                    .arg("--regions")
                    .arg(&config.regions_arg())
                    .arg("--method")
                    .arg(&config.model)
                    .stdout(Stdio::null())
                    .stderr(Stdio::piped())
                    .status()
                    .map_err(|e| format!("Failed to run OpenCV fallback: {}", e))?;

                if !fallback_status.success() {
                    let _ = std::fs::remove_dir_all(&temp_base);
                    return Err("OpenCV inpainting fallback failed".to_string());
                }
            }

            // Update progress to 90%
            if let Ok(mut map) = get_render_progress_map().lock() {
                map.insert(pid_clone.clone(), 0.90);
            }

            // === Step 4: Reassemble frames (90-100%) ===
            let (crf, preset) = quality_to_crf(&quality);
            let output_pattern = output_frames_dir.join("frame_%05d.png");
            let reassemble_args = build_reassemble_frames_args(
                &output_pattern.to_string_lossy(),
                &input,
                &output,
                fps,
                crf,
                preset,
            );

            log::info!("Reassembling: ffmpeg {}", reassemble_args.join(" "));

            let reassemble_status = Command::new("ffmpeg")
                .args(&reassemble_args)
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .status()
                .map_err(|e| format!("Failed to reassemble frames: {}", e))?;

            if !reassemble_status.success() {
                let _ = std::fs::remove_dir_all(&temp_base);
                return Err("FFmpeg frame reassembly failed".to_string());
            }

            // === Step 5: Cleanup ===
            let _ = std::fs::remove_dir_all(&temp_base);

            // Mark complete
            if let Ok(mut map) = get_render_progress_map().lock() {
                map.insert(pid_clone.clone(), 1.0);
            }

            Ok::<(), String>(())
        })
        .await;

        if let Err(e) = result {
            log::error!("Watermark removal failed: {:?}", e);
        }
    });

    Ok(process_id)
}
