use std::path::Path;
use std::process::Command;

use super::VideoInfo;

/// Run ffprobe on the given file path and parse the JSON output into VideoInfo.
pub fn probe_video_info(path: &str) -> Result<VideoInfo, String> {
    let path = Path::new(path);
    if !path.exists() {
        return Err(format!("File not found: {}", path.display()));
    }

    // Get video stream info via ffprobe JSON output
    let output = Command::new(super::ffprobe_path())
        .args([
            "-v",
            "quiet",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
            "-select_streams",
            "v:0",
        ])
        .arg(path)
        .output()
        .map_err(|e| format!("Failed to execute ffprobe: {}. Is FFmpeg installed?", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffprobe failed: {}", stderr));
    }

    let json_str =
        String::from_utf8(output.stdout).map_err(|e| format!("Invalid ffprobe output: {}", e))?;

    parse_ffprobe_json(&json_str, path)
}

/// Parse ffprobe JSON output into VideoInfo
fn parse_ffprobe_json(json_str: &str, path: &Path) -> Result<VideoInfo, String> {
    let json: serde_json::Value =
        serde_json::from_str(json_str).map_err(|e| format!("Failed to parse ffprobe JSON: {}", e))?;

    // Extract video stream info
    let stream = json
        .get("streams")
        .and_then(|s| s.as_array())
        .and_then(|arr| arr.first())
        .ok_or_else(|| "No video stream found".to_string())?;

    let width = stream
        .get("width")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "Missing video width".to_string())? as u32;

    let height = stream
        .get("height")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "Missing video height".to_string())? as u32;

    let codec = stream
        .get("codec_name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    // Parse FPS from r_frame_rate (e.g. "30000/1001")
    let fps = stream
        .get("r_frame_rate")
        .and_then(|v| v.as_str())
        .map(parse_frame_rate)
        .unwrap_or(Ok(0.0))
        .unwrap_or(0.0);

    // Duration: try stream first, then format
    let duration = stream
        .get("duration")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<f64>().ok())
        .or_else(|| {
            json.get("format")
                .and_then(|f| f.get("duration"))
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<f64>().ok())
        })
        .unwrap_or(0.0);

    // File size from format, or fallback to filesystem metadata
    let file_size = json
        .get("format")
        .and_then(|f| f.get("size"))
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or_else(|| {
            std::fs::metadata(path)
                .map(|m| m.len())
                .unwrap_or(0)
        });

    Ok(VideoInfo {
        width,
        height,
        duration,
        fps,
        codec,
        file_size,
    })
}

/// Parse frame rate string like "30000/1001" or "30" into f64
fn parse_frame_rate(rate: &str) -> Result<f64, String> {
    if let Some((num, den)) = rate.split_once('/') {
        let num: f64 = num
            .parse()
            .map_err(|_| format!("Invalid frame rate numerator: {}", num))?;
        let den: f64 = den
            .parse()
            .map_err(|_| format!("Invalid frame rate denominator: {}", den))?;
        if den == 0.0 {
            return Err("Frame rate denominator is zero".to_string());
        }
        Ok(num / den)
    } else {
        rate.parse::<f64>()
            .map_err(|_| format!("Invalid frame rate: {}", rate))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_parse_frame_rate_fraction() {
        let fps = parse_frame_rate("30000/1001").unwrap();
        assert!((fps - 29.97).abs() < 0.01);
    }

    #[test]
    fn test_parse_frame_rate_integer() {
        let fps = parse_frame_rate("30").unwrap();
        assert!((fps - 30.0).abs() < 0.01);
    }

    #[test]
    fn test_parse_ffprobe_json() {
        let json = r#"{
            "streams": [{
                "width": 1920,
                "height": 1080,
                "codec_name": "h264",
                "r_frame_rate": "30/1",
                "duration": "120.5"
            }],
            "format": {
                "duration": "120.5",
                "size": "15000000"
            }
        }"#;
        let info = parse_ffprobe_json(json, Path::new("/tmp/test.mp4")).unwrap();
        assert_eq!(info.width, 1920);
        assert_eq!(info.height, 1080);
        assert_eq!(info.codec, "h264");
        assert!((info.fps - 30.0).abs() < 0.01);
        assert!((info.duration - 120.5).abs() < 0.01);
        assert_eq!(info.file_size, 15000000);
    }
}
