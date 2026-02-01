use serde::{Deserialize, Serialize};

/// Text overlay configuration sent from the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TextRenderConfig {
    pub content: String,
    pub font_family: String,
    pub font_size: u32,
    pub color: String,
    pub stroke_color: String,
    pub stroke_width: f64,
    pub bg_color: String,
    pub bg_opacity: u32,
    pub align: String,
    /// Proportional x position (0-1)
    pub x: f64,
    /// Proportional y position (0-1)
    pub y: f64,
    /// Start time in seconds
    pub start_time: f64,
    /// End time in seconds (-1 = entire video)
    pub end_time: f64,
}

/// Subtitle render configuration sent from the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubtitleRenderConfig {
    /// SRT content as string
    pub srt_content: String,
    /// Font family name
    pub font_family: String,
    /// Font size
    pub font_size: u32,
    /// Text color (hex)
    pub color: String,
    /// Stroke color (hex)
    pub stroke_color: String,
    /// Stroke width
    pub stroke_width: f64,
    /// Vertical position ratio (0-1)
    pub position_y: f64,
}

/// Convert hex color (#RRGGBB) to FFmpeg color format (0xRRGGBB or with alpha).
fn hex_to_ffmpeg_color(hex: &str) -> String {
    // Remove # prefix if present
    let hex = hex.trim_start_matches('#');
    // FFmpeg uses 0x prefix
    format!("0x{}", hex)
}

/// Convert hex color to ASS color format (&HBBGGRR&) for subtitles filter.
fn hex_to_ass_color(hex: &str) -> String {
    let hex = hex.trim_start_matches('#');
    if hex.len() >= 6 {
        let r = &hex[0..2];
        let g = &hex[2..4];
        let b = &hex[4..6];
        format!("&H00{}{}{}&", b.to_uppercase(), g.to_uppercase(), r.to_uppercase())
    } else {
        "&H00FFFFFF&".to_string()
    }
}

/// Escape text for FFmpeg drawtext filter.
/// Characters that need escaping: ', \, :, ;, [, ]
fn escape_drawtext(text: &str) -> String {
    text.replace('\\', "\\\\\\\\")
        .replace('\'', "'\\\\\\''")
        .replace(':', "\\\\\\:")
        .replace(';', "\\\\\\;")
        .replace('[', "\\\\\\[")
        .replace(']', "\\\\\\]")
        .replace('%', "\\\\\\%")
}

/// Map font family name to a font file path or fontconfig name for FFmpeg.
/// On macOS, system fonts are in /System/Library/Fonts/ or ~/Library/Fonts/.
/// On Linux, use fontconfig.
/// On Windows, use C:\Windows\Fonts\.
fn resolve_font_for_ffmpeg(font_family: &str) -> String {
    // Try to find common fonts by name
    let font_name = font_family
        .split(',')
        .next()
        .unwrap_or(font_family)
        .trim();

    // For macOS, try known paths first
    #[cfg(target_os = "macos")]
    {
        let mac_paths = [
            format!("/System/Library/Fonts/{}.ttf", font_name.replace(' ', "")),
            format!("/System/Library/Fonts/{}.ttc", font_name.replace(' ', "")),
            format!("/System/Library/Fonts/Supplemental/{}.ttf", font_name.replace(' ', "")),
            format!("/System/Library/Fonts/Supplemental/{}.ttc", font_name.replace(' ', "")),
            format!("/Library/Fonts/{}.ttf", font_name.replace(' ', "")),
            format!("/Library/Fonts/{}.ttc", font_name.replace(' ', "")),
            // PingFang specifically
            "/System/Library/Fonts/PingFang.ttc".to_string(),
            // Noto fonts from Homebrew or user-installed
            format!("/opt/homebrew/share/fonts/{}-Regular.ttf", font_name.replace(' ', "")),
            format!("/usr/local/share/fonts/{}-Regular.ttf", font_name.replace(' ', "")),
        ];

        for path in &mac_paths {
            if std::path::Path::new(path).exists() {
                return path.clone();
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let win_paths = [
            format!("C\\\\:/Windows/Fonts/{}.ttf", font_name.replace(' ', "")),
            format!("C\\\\:/Windows/Fonts/{}.ttc", font_name.replace(' ', "")),
        ];

        for path in &win_paths {
            if std::path::Path::new(path.replace("\\\\", "").as_str()).exists() {
                return path.clone();
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let linux_paths = [
            format!("/usr/share/fonts/truetype/noto/{}-Regular.ttf", font_name.replace(' ', "")),
            format!("/usr/share/fonts/opentype/noto/{}-Regular.otf", font_name.replace(' ', "")),
            format!("/usr/share/fonts/truetype/{}.ttf", font_name.replace(' ', "")),
        ];

        for path in &linux_paths {
            if std::path::Path::new(path).exists() {
                return path.clone();
            }
        }
    }

    // Fallback: use fontconfig name (FFmpeg can use font= instead of fontfile=)
    font_name.to_string()
}

/// Build FFmpeg drawtext filter string for a single text overlay.
pub fn build_drawtext_filter(
    text: &TextRenderConfig,
    video_width: u32,
    video_height: u32,
) -> String {
    let px_x = (text.x * video_width as f64).round() as i32;
    let px_y = (text.y * video_height as f64).round() as i32;
    let font_size = text.font_size;
    let color = hex_to_ffmpeg_color(&text.color);
    let escaped_text = escape_drawtext(&text.content);

    let font_resolved = resolve_font_for_ffmpeg(&text.font_family);

    let mut filter_parts: Vec<String> = Vec::new();

    // Use fontfile if it's a path, otherwise use font name
    if font_resolved.contains('/') || font_resolved.contains('\\') {
        filter_parts.push(format!("fontfile='{}'", font_resolved));
    } else {
        filter_parts.push(format!("font='{}'", font_resolved));
    }

    filter_parts.push(format!("text='{}'", escaped_text));
    filter_parts.push(format!("fontsize={}", font_size));
    filter_parts.push(format!("fontcolor={}", color));
    filter_parts.push(format!("x={}", px_x));
    filter_parts.push(format!("y={}", px_y));

    // Stroke/border
    if text.stroke_width > 0.0 {
        let stroke_color = hex_to_ffmpeg_color(&text.stroke_color);
        filter_parts.push(format!("borderw={}", text.stroke_width.round() as u32));
        filter_parts.push(format!("bordercolor={}", stroke_color));
    }

    // Background box
    if text.bg_opacity > 0 {
        let bg_color = hex_to_ffmpeg_color(&text.bg_color);
        let alpha = (text.bg_opacity as f64 / 100.0).clamp(0.0, 1.0);
        filter_parts.push(format!("box=1"));
        filter_parts.push(format!("boxcolor={}@{:.2}", bg_color, alpha));
        filter_parts.push(format!("boxborderw=5"));
    }

    // Time range (enable expression)
    let enable_expr = build_enable_expression(text.start_time, text.end_time);
    if !enable_expr.is_empty() {
        filter_parts.push(format!("enable='{}'", enable_expr));
    }

    format!("drawtext={}", filter_parts.join(":"))
}

/// Build the enable expression for time-range visibility.
fn build_enable_expression(start_time: f64, end_time: f64) -> String {
    if start_time <= 0.0 && end_time < 0.0 {
        // Entire video — no enable needed
        return String::new();
    }

    if end_time < 0.0 {
        // From start_time to end of video
        format!("gte(t,{:.3})", start_time)
    } else {
        format!("between(t,{:.3},{:.3})", start_time, end_time)
    }
}

/// Build a combined filter string for multiple text overlays.
/// Returns the drawtext filter chain to be appended to the filter_complex.
pub fn build_text_filter_chain(
    texts: &[TextRenderConfig],
    video_width: u32,
    video_height: u32,
) -> String {
    if texts.is_empty() {
        return String::new();
    }

    texts
        .iter()
        .map(|t| build_drawtext_filter(t, video_width, video_height))
        .collect::<Vec<_>>()
        .join(",")
}

/// Build FFmpeg subtitles filter for SRT content.
/// This writes the SRT content to a temp file and uses the subtitles filter.
///
/// Returns (temp_file_path, filter_string).
pub fn build_subtitles_filter(
    subtitle: &SubtitleRenderConfig,
    temp_dir: &str,
) -> Result<(String, String), String> {
    // Write SRT content to a temp file
    let srt_path = format!("{}/temp_subtitle.srt", temp_dir);
    std::fs::write(&srt_path, &subtitle.srt_content)
        .map_err(|e| format!("Failed to write temp SRT file: {}", e))?;

    // Build force_style for ASS styling
    let primary_color = hex_to_ass_color(&subtitle.color);
    let outline_color = hex_to_ass_color(&subtitle.stroke_color);
    let font_name = subtitle
        .font_family
        .split(',')
        .next()
        .unwrap_or(&subtitle.font_family)
        .trim();

    // Calculate vertical alignment from position_y ratio
    // ASS MarginV: distance from bottom of screen
    // For position_y = 0.85, we want a small margin from bottom
    let margin_v = ((1.0 - subtitle.position_y) * 100.0).round() as u32;

    let force_style = format!(
        "FontName={},FontSize={},PrimaryColour={},OutlineColour={},OutlineWidth={},MarginV={},Alignment=2",
        font_name,
        subtitle.font_size,
        primary_color,
        outline_color,
        subtitle.stroke_width.round() as u32,
        margin_v,
    );

    // Escape the path for FFmpeg (especially on Windows)
    let escaped_path = srt_path.replace('\\', "/").replace(':', "\\:");

    let filter = format!(
        "subtitles='{}'{}",
        escaped_path,
        format!(":force_style='{}'", force_style),
    );

    Ok((srt_path, filter))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_to_ffmpeg_color() {
        assert_eq!(hex_to_ffmpeg_color("#ffffff"), "0xffffff");
        assert_eq!(hex_to_ffmpeg_color("#000000"), "0x000000");
        assert_eq!(hex_to_ffmpeg_color("ff0000"), "0xff0000");
    }

    #[test]
    fn test_hex_to_ass_color() {
        assert_eq!(hex_to_ass_color("#ffffff"), "&H00FFFFFF&");
        assert_eq!(hex_to_ass_color("#ff0000"), "&H000000FF&");
        assert_eq!(hex_to_ass_color("#00ff00"), "&H0000FF00&");
    }

    #[test]
    fn test_escape_drawtext() {
        assert_eq!(escape_drawtext("hello"), "hello");
        assert_eq!(escape_drawtext("it's"), "it'\\\\\\''s");
        assert!(escape_drawtext("a:b").contains("\\\\\\:"));
    }

    #[test]
    fn test_build_drawtext_filter_static() {
        let config = TextRenderConfig {
            content: "Hello".to_string(),
            font_family: "Arial".to_string(),
            font_size: 32,
            color: "#ffffff".to_string(),
            stroke_color: "#000000".to_string(),
            stroke_width: 0.0,
            bg_color: "#000000".to_string(),
            bg_opacity: 0,
            align: "center".to_string(),
            x: 0.1,
            y: 0.1,
            start_time: 0.0,
            end_time: -1.0,
        };

        let filter = build_drawtext_filter(&config, 1920, 1080);
        assert!(filter.starts_with("drawtext="));
        assert!(filter.contains("text='Hello'"));
        assert!(filter.contains("fontsize=32"));
        assert!(filter.contains("fontcolor=0xffffff"));
    }

    #[test]
    fn test_build_drawtext_filter_with_stroke() {
        let config = TextRenderConfig {
            content: "Test".to_string(),
            font_family: "Arial".to_string(),
            font_size: 24,
            color: "#ffffff".to_string(),
            stroke_color: "#000000".to_string(),
            stroke_width: 2.0,
            bg_color: "#000000".to_string(),
            bg_opacity: 0,
            align: "center".to_string(),
            x: 0.5,
            y: 0.5,
            start_time: 0.0,
            end_time: -1.0,
        };

        let filter = build_drawtext_filter(&config, 1920, 1080);
        assert!(filter.contains("borderw=2"));
        assert!(filter.contains("bordercolor=0x000000"));
    }

    #[test]
    fn test_build_drawtext_filter_with_time_range() {
        let config = TextRenderConfig {
            content: "Timed".to_string(),
            font_family: "Arial".to_string(),
            font_size: 24,
            color: "#ffffff".to_string(),
            stroke_color: "#000000".to_string(),
            stroke_width: 0.0,
            bg_color: "#000000".to_string(),
            bg_opacity: 0,
            align: "center".to_string(),
            x: 0.5,
            y: 0.5,
            start_time: 5.0,
            end_time: 10.0,
        };

        let filter = build_drawtext_filter(&config, 1920, 1080);
        assert!(filter.contains("enable='between(t,5.000,10.000)'"));
    }

    #[test]
    fn test_build_drawtext_filter_with_bg() {
        let config = TextRenderConfig {
            content: "BG".to_string(),
            font_family: "Arial".to_string(),
            font_size: 24,
            color: "#ffffff".to_string(),
            stroke_color: "#000000".to_string(),
            stroke_width: 0.0,
            bg_color: "#000000".to_string(),
            bg_opacity: 50,
            align: "center".to_string(),
            x: 0.5,
            y: 0.5,
            start_time: 0.0,
            end_time: -1.0,
        };

        let filter = build_drawtext_filter(&config, 1920, 1080);
        assert!(filter.contains("box=1"));
        assert!(filter.contains("boxcolor=0x000000@0.50"));
    }

    #[test]
    fn test_build_text_filter_chain_empty() {
        let chain = build_text_filter_chain(&[], 1920, 1080);
        assert!(chain.is_empty());
    }

    #[test]
    fn test_build_text_filter_chain_multiple() {
        let texts = vec![
            TextRenderConfig {
                content: "A".to_string(),
                font_family: "Arial".to_string(),
                font_size: 24,
                color: "#ffffff".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 0.0,
                bg_color: "#000000".to_string(),
                bg_opacity: 0,
                align: "center".to_string(),
                x: 0.1,
                y: 0.1,
                start_time: 0.0,
                end_time: -1.0,
            },
            TextRenderConfig {
                content: "B".to_string(),
                font_family: "Arial".to_string(),
                font_size: 32,
                color: "#ff0000".to_string(),
                stroke_color: "#000000".to_string(),
                stroke_width: 1.0,
                bg_color: "#000000".to_string(),
                bg_opacity: 0,
                align: "center".to_string(),
                x: 0.5,
                y: 0.5,
                start_time: 0.0,
                end_time: -1.0,
            },
        ];

        let chain = build_text_filter_chain(&texts, 1920, 1080);
        // Multiple drawtext filters separated by comma
        assert!(chain.contains(",drawtext="));
    }

    #[test]
    fn test_enable_expression() {
        assert_eq!(build_enable_expression(0.0, -1.0), "");
        assert_eq!(build_enable_expression(5.0, -1.0), "gte(t,5.000)");
        assert_eq!(
            build_enable_expression(2.0, 8.0),
            "between(t,2.000,8.000)"
        );
    }

    #[test]
    fn test_subtitles_filter() {
        let config = SubtitleRenderConfig {
            srt_content: "1\n00:00:01,000 --> 00:00:04,000\nHello\n".to_string(),
            font_family: "Noto Sans TC, sans-serif".to_string(),
            font_size: 24,
            color: "#ffffff".to_string(),
            stroke_color: "#000000".to_string(),
            stroke_width: 2.0,
            position_y: 0.85,
        };

        let temp_dir = std::env::temp_dir().to_string_lossy().to_string();
        let result = build_subtitles_filter(&config, &temp_dir);
        assert!(result.is_ok());

        let (path, filter) = result.unwrap();
        assert!(filter.contains("subtitles="));
        assert!(filter.contains("force_style="));
        assert!(filter.contains("FontName=Noto Sans TC"));
        assert!(filter.contains("FontSize=24"));

        // Clean up temp file
        let _ = std::fs::remove_file(path);
    }
}
