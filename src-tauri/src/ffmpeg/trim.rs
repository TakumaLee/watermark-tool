use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

/// A clip segment for trim/concat operations
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipSegment {
    /// Source video file path
    pub source_path: String,
    /// Start time in seconds
    pub start_time: f64,
    /// End time in seconds
    pub end_time: f64,
}

/// Trim a single clip from a video using FFmpeg.
/// Uses `-ss` (before input for fast seek) and `-to` for the duration.
pub fn trim_video(
    input: &str,
    output: &str,
    start: f64,
    end: f64,
    quality: &str,
    progress_callback: Option<&dyn Fn(f64)>,
) -> Result<(), String> {
    let duration = end - start;
    if duration <= 0.0 {
        return Err("Invalid trim range: end must be after start".to_string());
    }

    let (crf, preset) = quality_to_crf_trim(quality);

    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());
    // Fast seek to start position (before -i for speed)
    args.push("-ss".to_string());
    args.push(format!("{:.3}", start));
    args.push("-i".to_string());
    args.push(input.to_string());
    // End position relative to the seeked position
    args.push("-to".to_string());
    args.push(format!("{:.3}", duration));
    // Encoding
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
    // Progress
    args.push("-progress".to_string());
    args.push("pipe:2".to_string());
    args.push(output.to_string());

    log::info!("Trim FFmpeg: ffmpeg {}", args.join(" "));

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {}. Is FFmpeg installed?", e))?;

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            if let Some(progress) = parse_trim_progress(&line, duration) {
                if let Some(cb) = progress_callback {
                    cb(progress.clamp(0.0, 0.99));
                }
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for ffmpeg: {}", e))?;

    if !status.success() {
        return Err(format!(
            "FFmpeg trim exited with status: {}",
            status.code().unwrap_or(-1)
        ));
    }

    Ok(())
}

/// Concatenate multiple clip segments into a single output video.
/// Uses the concat demuxer approach for efficiency.
pub fn concat_videos(
    segments: &[ClipSegment],
    output: &str,
    quality: &str,
    temp_dir: &str,
    progress_callback: Option<&dyn Fn(f64)>,
) -> Result<(), String> {
    if segments.is_empty() {
        return Err("No segments to concatenate".to_string());
    }

    // If there's only one segment, just trim it directly
    if segments.len() == 1 {
        let seg = &segments[0];
        return trim_video(
            &seg.source_path,
            output,
            seg.start_time,
            seg.end_time,
            quality,
            progress_callback,
        );
    }

    let (crf, preset) = quality_to_crf_trim(quality);

    // Step 1: Trim each segment to a temp file
    let mut temp_files: Vec<String> = Vec::new();
    let total_duration: f64 = segments.iter().map(|s| s.end_time - s.start_time).sum();
    let mut accumulated_duration = 0.0;

    for (i, seg) in segments.iter().enumerate() {
        let temp_path = format!("{}/segment_{}.mp4", temp_dir, i);
        let seg_duration = seg.end_time - seg.start_time;

        let offset = accumulated_duration;
        trim_video(
            &seg.source_path,
            &temp_path,
            seg.start_time,
            seg.end_time,
            quality,
            Some(&|p: f64| {
                if let Some(cb) = progress_callback.as_ref() {
                    let overall = (offset + p * seg_duration) / total_duration * 0.8; // 80% for trimming
                    cb(overall);
                }
            }),
        )?;

        temp_files.push(temp_path);
        accumulated_duration += seg_duration;
    }

    // Step 2: Create concat list file
    let list_path = format!("{}/concat_list.txt", temp_dir);
    let list_content: String = temp_files
        .iter()
        .map(|f| format!("file '{}'", f.replace('\'', "'\\''")))
        .collect::<Vec<_>>()
        .join("\n");

    std::fs::write(&list_path, &list_content)
        .map_err(|e| format!("Failed to write concat list: {}", e))?;

    // Step 3: Concat using demuxer
    let mut args: Vec<String> = Vec::new();
    args.push("-y".to_string());
    args.push("-f".to_string());
    args.push("concat".to_string());
    args.push("-safe".to_string());
    args.push("0".to_string());
    args.push("-i".to_string());
    args.push(list_path.clone());
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

    log::info!("Concat FFmpeg: ffmpeg {}", args.join(" "));

    let mut child = Command::new("ffmpeg")
        .args(&args)
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg for concat: {}", e))?;

    if let Some(stderr) = child.stderr.take() {
        let reader = BufReader::new(stderr);
        for line in reader.lines().flatten() {
            if let Some(progress) = parse_trim_progress(&line, total_duration) {
                if let Some(cb) = progress_callback {
                    cb(0.8 + progress * 0.2); // Last 20% for concat
                }
            }
        }
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for ffmpeg concat: {}", e))?;

    // Clean up temp files
    for f in &temp_files {
        let _ = std::fs::remove_file(f);
    }
    let _ = std::fs::remove_file(&list_path);

    if !status.success() {
        return Err(format!(
            "FFmpeg concat exited with status: {}",
            status.code().unwrap_or(-1)
        ));
    }

    Ok(())
}

/// Map quality label to CRF/preset for trim operations
fn quality_to_crf_trim(quality: &str) -> (u32, &str) {
    match quality {
        "original" => (18, "slow"),
        "high" => (20, "medium"),
        "medium" => (23, "medium"),
        "low" => (28, "fast"),
        _ => (23, "medium"),
    }
}

/// Parse FFmpeg progress for trim operations
fn parse_trim_progress(line: &str, total_duration: f64) -> Option<f64> {
    if total_duration <= 0.0 {
        return None;
    }

    if let Some(value) = line.strip_prefix("out_time_us=") {
        if let Ok(us) = value.trim().parse::<f64>() {
            let seconds = us / 1_000_000.0;
            return Some(seconds / total_duration);
        }
    }

    if let Some(pos) = line.find("time=") {
        let time_str = &line[pos + 5..];
        let end = time_str
            .find(|c: char| c == ' ' || c == '\n' || c == '\r')
            .unwrap_or(time_str.len());
        let time_part = &time_str[..end];
        if let Some(seconds) = parse_time_str(time_part.trim()) {
            return Some(seconds / total_duration);
        }
    }

    None
}

fn parse_time_str(time: &str) -> Option<f64> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quality_to_crf_trim() {
        assert_eq!(quality_to_crf_trim("original"), (18, "slow"));
        assert_eq!(quality_to_crf_trim("high"), (20, "medium"));
        assert_eq!(quality_to_crf_trim("medium"), (23, "medium"));
        assert_eq!(quality_to_crf_trim("low"), (28, "fast"));
        assert_eq!(quality_to_crf_trim("unknown"), (23, "medium"));
    }

    #[test]
    fn test_parse_trim_progress_out_time_us() {
        let p = parse_trim_progress("out_time_us=30000000", 60.0).unwrap();
        assert!((p - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_parse_trim_progress_time_pattern() {
        let p = parse_trim_progress("frame=50 time=00:00:15.00 speed=2x", 60.0).unwrap();
        assert!((p - 0.25).abs() < 0.01);
    }

    #[test]
    fn test_parse_trim_progress_zero_duration() {
        assert!(parse_trim_progress("out_time_us=30000000", 0.0).is_none());
    }

    #[test]
    fn test_clip_segment_serialization() {
        let seg = ClipSegment {
            source_path: "/tmp/video.mp4".to_string(),
            start_time: 10.0,
            end_time: 20.0,
        };
        let json = serde_json::to_string(&seg).unwrap();
        let parsed: ClipSegment = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.source_path, "/tmp/video.mp4");
        assert_eq!(parsed.start_time, 10.0);
        assert_eq!(parsed.end_time, 20.0);
    }
}
