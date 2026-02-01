use serde::{Deserialize, Serialize};

/// Platform export configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlatformExportConfig {
    /// Output width
    pub width: u32,
    /// Output height
    pub height: u32,
    /// Aspect ratio mode: "pad" or "crop"
    pub aspect_mode: String,
    /// Quality: "highest", "high", "medium", "low"
    pub quality: String,
    /// Format: "mp4" or "mov"
    pub format: String,
    /// Max duration in seconds (0 = no limit)
    pub max_duration: f64,
}

/// GIF export configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GifExportConfig {
    /// Output width (px)
    pub width: u32,
    /// Frames per second
    pub fps: u32,
    /// Color count (2-256)
    pub colors: u32,
    /// Start time in seconds
    pub start_time: f64,
    /// End time in seconds (-1 = entire video)
    pub end_time: f64,
}

/// Thumbnail extract configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThumbnailConfig {
    /// Time position in seconds
    pub time: f64,
    /// Output format: "jpg" or "png"
    pub format: String,
    /// Quality (1-31 for jpg, lower=better)
    pub quality: u32,
}

/// Build the scale+pad filter for platform export (letterbox/pillarbox)
pub fn build_scale_pad_filter(
    target_width: u32,
    target_height: u32,
    mode: &str,
) -> String {
    match mode {
        "crop" => {
            // Scale to cover, then crop center
            format!(
                "scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}",
                target_width, target_height, target_width, target_height
            )
        }
        _ => {
            // "pad" — scale to fit, then pad with black bars
            format!(
                "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2:black",
                target_width, target_height, target_width, target_height
            )
        }
    }
}

/// Build quality parameters for platform export
pub fn platform_quality_to_params(quality: &str) -> (u32, &'static str) {
    match quality {
        "highest" => (16, "slow"),
        "high" => (20, "medium"),
        "medium" => (26, "medium"),
        "low" => (32, "fast"),
        _ => (20, "medium"),
    }
}

/// Build the GIF palette generation filter
pub fn build_gif_palettegen_filter(width: u32, fps: u32) -> String {
    format!(
        "fps={},scale={}:-1:flags=lanczos,palettegen=max_colors={}",
        fps, width, 256
    )
}

/// Build the GIF palette use filter
pub fn build_gif_paletteuse_filter(width: u32, fps: u32, _colors: u32) -> String {
    format!(
        "fps={},scale={}:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a",
        fps, width
    )
}

/// Build the GIF time range args
pub fn build_gif_time_args(start_time: f64, end_time: f64, duration: f64) -> Vec<String> {
    let mut args = Vec::new();
    if start_time > 0.0 {
        args.push("-ss".to_string());
        args.push(format!("{:.3}", start_time));
    }
    let actual_end = if end_time < 0.0 { duration } else { end_time };
    if actual_end < duration && actual_end > start_time {
        args.push("-to".to_string());
        args.push(format!("{:.3}", actual_end));
    }
    args
}

/// Build thumbnail extraction args
pub fn build_thumbnail_args(
    input: &str,
    output: &str,
    time: f64,
    format: &str,
    quality: u32,
) -> Vec<String> {
    let mut args = vec![
        "-y".to_string(),
        "-ss".to_string(),
        format!("{:.3}", time),
        "-i".to_string(),
        input.to_string(),
        "-vframes".to_string(),
        "1".to_string(),
    ];

    match format {
        "png" => {
            args.push("-c:v".to_string());
            args.push("png".to_string());
        }
        _ => {
            // jpg
            args.push("-q:v".to_string());
            args.push(quality.clamp(1, 31).to_string());
        }
    }

    args.push(output.to_string());
    args
}

/// Estimate GIF file size in bytes (rough approximation)
pub fn estimate_gif_size(
    width: u32,
    fps: u32,
    duration: f64,
    colors: u32,
) -> u64 {
    // Rough estimate: width * (width * 9/16) * fps * duration * bytes_per_pixel_compressed
    // GIF compression ratio varies widely, use ~0.3 bytes per pixel as estimate
    let height = (width as f64 * 9.0 / 16.0) as u64;
    let frame_count = (fps as f64 * duration) as u64;
    let bytes_per_pixel = if colors <= 16 { 0.15 } else { 0.3 };
    let raw_size = width as f64 * height as f64 * frame_count as f64 * bytes_per_pixel;
    raw_size as u64
}

/// Build the max duration filter (if applicable)
pub fn build_duration_args(max_duration: f64) -> Vec<String> {
    if max_duration > 0.0 {
        vec!["-t".to_string(), format!("{:.3}", max_duration)]
    } else {
        Vec::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_scale_pad_filter_pad_mode() {
        let filter = build_scale_pad_filter(1080, 1920, "pad");
        assert!(filter.contains("scale=1080:1920:force_original_aspect_ratio=decrease"));
        assert!(filter.contains("pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black"));
    }

    #[test]
    fn test_scale_pad_filter_crop_mode() {
        let filter = build_scale_pad_filter(1080, 1920, "crop");
        assert!(filter.contains("scale=1080:1920:force_original_aspect_ratio=increase"));
        assert!(filter.contains("crop=1080:1920"));
    }

    #[test]
    fn test_platform_quality_highest() {
        let (crf, preset) = platform_quality_to_params("highest");
        assert_eq!(crf, 16);
        assert_eq!(preset, "slow");
    }

    #[test]
    fn test_platform_quality_low() {
        let (crf, preset) = platform_quality_to_params("low");
        assert_eq!(crf, 32);
        assert_eq!(preset, "fast");
    }

    #[test]
    fn test_gif_palettegen_filter() {
        let filter = build_gif_palettegen_filter(480, 15);
        assert!(filter.contains("fps=15"));
        assert!(filter.contains("scale=480:-1:flags=lanczos"));
        assert!(filter.contains("palettegen"));
    }

    #[test]
    fn test_gif_paletteuse_filter() {
        let filter = build_gif_paletteuse_filter(480, 15, 256);
        assert!(filter.contains("fps=15"));
        assert!(filter.contains("scale=480:-1:flags=lanczos"));
        assert!(filter.contains("paletteuse"));
    }

    #[test]
    fn test_gif_time_args_full_video() {
        let args = build_gif_time_args(0.0, -1.0, 60.0);
        assert!(args.is_empty());
    }

    #[test]
    fn test_gif_time_args_range() {
        let args = build_gif_time_args(5.0, 15.0, 60.0);
        assert_eq!(args.len(), 4);
        assert_eq!(args[0], "-ss");
        assert_eq!(args[1], "5.000");
        assert_eq!(args[2], "-to");
        assert_eq!(args[3], "15.000");
    }

    #[test]
    fn test_thumbnail_args_jpg() {
        let args = build_thumbnail_args("/input.mp4", "/thumb.jpg", 10.0, "jpg", 2);
        assert!(args.contains(&"-ss".to_string()));
        assert!(args.contains(&"-vframes".to_string()));
        assert!(args.contains(&"-q:v".to_string()));
        assert!(args.contains(&"2".to_string()));
    }

    #[test]
    fn test_thumbnail_args_png() {
        let args = build_thumbnail_args("/input.mp4", "/thumb.png", 5.0, "png", 2);
        assert!(args.contains(&"-c:v".to_string()));
        assert!(args.contains(&"png".to_string()));
        assert!(!args.contains(&"-q:v".to_string()));
    }

    #[test]
    fn test_estimate_gif_size() {
        let size = estimate_gif_size(480, 15, 10.0, 256);
        // Should be a reasonable size (not 0, not absurdly large)
        assert!(size > 0);
        assert!(size < 100_000_000); // Less than 100MB for 10s
    }

    #[test]
    fn test_duration_args_no_limit() {
        let args = build_duration_args(0.0);
        assert!(args.is_empty());
    }

    #[test]
    fn test_duration_args_with_limit() {
        let args = build_duration_args(140.0);
        assert_eq!(args.len(), 2);
        assert_eq!(args[0], "-t");
        assert_eq!(args[1], "140.000");
    }

    #[test]
    fn test_platform_export_config_serialization() {
        let config = PlatformExportConfig {
            width: 1080,
            height: 1920,
            aspect_mode: "pad".to_string(),
            quality: "high".to_string(),
            format: "mp4".to_string(),
            max_duration: 90.0,
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: PlatformExportConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.width, 1080);
        assert_eq!(parsed.height, 1920);
        assert_eq!(parsed.max_duration, 90.0);
    }

    #[test]
    fn test_gif_export_config_serialization() {
        let config = GifExportConfig {
            width: 480,
            fps: 15,
            colors: 256,
            start_time: 0.0,
            end_time: -1.0,
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: GifExportConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.fps, 15);
        assert_eq!(parsed.end_time, -1.0);
    }

    #[test]
    fn test_thumbnail_config_serialization() {
        let config = ThumbnailConfig {
            time: 10.5,
            format: "jpg".to_string(),
            quality: 2,
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: ThumbnailConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.time, 10.5);
        assert_eq!(parsed.format, "jpg");
    }
}
