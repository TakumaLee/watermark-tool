use serde::{Deserialize, Serialize};

// ============================================================
// AI Features — FFmpeg filter builders (Phase 11)
// ============================================================

// === Whisper Integration ===

/// Configuration for Whisper transcription
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhisperConfig {
    pub language: String,
    pub model: String,
}

/// A single whisper subtitle entry
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhisperEntry {
    pub index: usize,
    pub start_time: f64,
    pub end_time: f64,
    pub text: String,
}

/// Parse SRT output from whisper into WhisperEntry list
pub fn parse_srt_output(srt_content: &str) -> Vec<WhisperEntry> {
    let mut entries = Vec::new();
    let mut current_index: Option<usize> = None;
    let mut current_start: f64 = 0.0;
    let mut current_end: f64 = 0.0;
    let mut current_text_lines: Vec<String> = Vec::new();

    for line in srt_content.lines() {
        let line = line.trim();

        if line.is_empty() {
            // End of entry
            if let Some(idx) = current_index.take() {
                let text = current_text_lines.join(" ").trim().to_string();
                if !text.is_empty() {
                    entries.push(WhisperEntry {
                        index: idx,
                        start_time: current_start,
                        end_time: current_end,
                        text,
                    });
                }
                current_text_lines.clear();
            }
            continue;
        }

        if current_index.is_none() {
            // Try to parse as index number
            if let Ok(idx) = line.parse::<usize>() {
                current_index = Some(idx);
                continue;
            }
        }

        if current_index.is_some() && line.contains("-->") {
            // Parse time range: "00:00:01,000 --> 00:00:04,000"
            let parts: Vec<&str> = line.split("-->").collect();
            if parts.len() == 2 {
                current_start = parse_srt_time(parts[0].trim());
                current_end = parse_srt_time(parts[1].trim());
            }
            continue;
        }

        if current_index.is_some() {
            current_text_lines.push(line.to_string());
        }
    }

    // Handle last entry (no trailing blank line)
    if let Some(idx) = current_index {
        let text = current_text_lines.join(" ").trim().to_string();
        if !text.is_empty() {
            entries.push(WhisperEntry {
                index: idx,
                start_time: current_start,
                end_time: current_end,
                text,
            });
        }
    }

    entries
}

/// Parse SRT time format "HH:MM:SS,mmm" to seconds
fn parse_srt_time(time_str: &str) -> f64 {
    let time_str = time_str.replace(',', ".");
    let parts: Vec<&str> = time_str.split(':').collect();
    if parts.len() != 3 {
        return 0.0;
    }
    let hours: f64 = parts[0].parse().unwrap_or(0.0);
    let minutes: f64 = parts[1].parse().unwrap_or(0.0);
    let seconds: f64 = parts[2].parse().unwrap_or(0.0);
    hours * 3600.0 + minutes * 60.0 + seconds
}

// === Scene Detection ===

/// Detected scene change point
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScenePoint {
    pub timestamp: f64,
    pub score: f64,
}

/// Parse FFmpeg showinfo output to extract scene change timestamps
pub fn parse_scene_detect_output(output: &str, threshold: f64) -> Vec<ScenePoint> {
    let mut points = Vec::new();

    for line in output.lines() {
        // Look for lines from showinfo filter containing pts_time and scene score
        // Format: [Parsed_showinfo_...] n:XXX pts:XXX pts_time:XXX ...
        if line.contains("pts_time:") {
            if let Some(pts_time) = extract_field(line, "pts_time:") {
                if let Ok(timestamp) = pts_time.parse::<f64>() {
                    // The scene score might be on a different filter output line
                    // For select filter, frames passing the threshold are output
                    // We can use a default score or parse if available
                    points.push(ScenePoint {
                        timestamp,
                        score: threshold,
                    });
                }
            }
        }
    }

    points
}

/// Extract a field value from an FFmpeg log line
fn extract_field<'a>(line: &'a str, field: &str) -> Option<&'a str> {
    if let Some(start) = line.find(field) {
        let value_start = start + field.len();
        let rest = &line[value_start..];
        // Value ends at whitespace or end of line
        let end = rest
            .find(|c: char| c.is_whitespace())
            .unwrap_or(rest.len());
        Some(&rest[..end])
    } else {
        None
    }
}

/// Build FFmpeg args for scene detection
pub fn build_scene_detect_args(input: &str, threshold: f64) -> Vec<String> {
    vec![
        "-i".to_string(),
        input.to_string(),
        "-vf".to_string(),
        format!("select='gt(scene,{})',showinfo", threshold),
        "-f".to_string(),
        "null".to_string(),
        "-".to_string(),
    ]
}

// === Chromakey (Background Removal) ===

/// Chromakey filter configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChromakeyConfig {
    /// Color in hex format "0xRRGGBB"
    pub color: String,
    /// Similarity threshold (0.01-1.0)
    pub similarity: f64,
    /// Blend amount (0.0-1.0)
    pub blend: f64,
}

/// Build chromakey filter string
pub fn build_chromakey_filter(config: &ChromakeyConfig) -> String {
    format!(
        "chromakey=color={}:similarity={:.2}:blend={:.2}",
        config.color, config.similarity, config.blend
    )
}

// === Quality Enhancement ===

/// Enhancement filter configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnhancementConfig {
    pub sharpen: Option<SharpenConfig>,
    pub denoise: Option<DenoiseConfig>,
    pub upscale: Option<UpscaleConfig>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SharpenConfig {
    pub luma_x: u32,
    pub luma_y: u32,
    pub luma_amount: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DenoiseConfig {
    pub strength: f64,
    pub filter_type: String, // "nlmeans" or "hqdn3d"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpscaleConfig {
    pub scale_factor: f64,
}

/// Build enhancement filter chain
pub fn build_enhancement_filters(config: &EnhancementConfig) -> String {
    let mut filters: Vec<String> = Vec::new();

    // Sharpen (unsharp)
    if let Some(ref sharpen) = config.sharpen {
        filters.push(format!(
            "unsharp={}:{}:{:.1}:{}:{}:{:.1}",
            sharpen.luma_x,
            sharpen.luma_y,
            sharpen.luma_amount,
            sharpen.luma_x,
            sharpen.luma_y,
            sharpen.luma_amount
        ));
    }

    // Denoise
    if let Some(ref denoise) = config.denoise {
        match denoise.filter_type.as_str() {
            "nlmeans" => {
                let s = denoise.strength;
                filters.push(format!(
                    "nlmeans=s={:.0}:p=7:r=15",
                    s
                ));
            }
            "hqdn3d" | _ => {
                let s = denoise.strength;
                filters.push(format!(
                    "hqdn3d={:.1}:{:.1}:{:.1}:{:.1}",
                    s, s, s * 2.0, s * 2.0
                ));
            }
        }
    }

    // Upscale (scale with lanczos)
    if let Some(ref upscale) = config.upscale {
        let factor = upscale.scale_factor;
        filters.push(format!(
            "scale=iw*{:.1}:ih*{:.1}:flags=lanczos",
            factor, factor
        ));
    }

    filters.join(",")
}

// === Silence Detection ===

/// Silence detection configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SilenceDetectConfig {
    /// Noise threshold in dB (e.g., -30)
    pub noise_db: f64,
    /// Minimum silence duration in seconds
    pub min_duration: f64,
}

/// Detected silence segment
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SilenceSegment {
    pub start_time: f64,
    pub end_time: f64,
    pub duration: f64,
}

/// Build FFmpeg args for silence detection
pub fn build_silence_detect_args(input: &str, noise_db: f64, min_duration: f64) -> Vec<String> {
    vec![
        "-i".to_string(),
        input.to_string(),
        "-af".to_string(),
        format!(
            "silencedetect=noise={}dB:d={}",
            noise_db, min_duration
        ),
        "-f".to_string(),
        "null".to_string(),
        "-".to_string(),
    ]
}

/// Parse FFmpeg silencedetect output
pub fn parse_silence_detect_output(output: &str) -> Vec<SilenceSegment> {
    let mut segments = Vec::new();
    let mut current_start: Option<f64> = None;

    for line in output.lines() {
        if line.contains("silence_start:") {
            // [silencedetect @ 0x...] silence_start: 1.234
            if let Some(start_str) = line.split("silence_start:").nth(1) {
                if let Ok(start) = start_str.trim().parse::<f64>() {
                    current_start = Some(start);
                }
            }
        } else if line.contains("silence_end:") {
            // [silencedetect @ 0x...] silence_end: 5.678 | silence_duration: 4.444
            if let Some(end_part) = line.split("silence_end:").nth(1) {
                let parts: Vec<&str> = end_part.split('|').collect();
                if let Ok(end) = parts[0].trim().parse::<f64>() {
                    let duration = if parts.len() > 1 {
                        parts[1]
                            .trim()
                            .strip_prefix("silence_duration:")
                            .and_then(|s| s.trim().parse::<f64>().ok())
                            .unwrap_or(end - current_start.unwrap_or(0.0))
                    } else {
                        end - current_start.unwrap_or(0.0)
                    };

                    segments.push(SilenceSegment {
                        start_time: current_start.unwrap_or(end - duration),
                        end_time: end,
                        duration,
                    });
                    current_start = None;
                }
            }
        }
    }

    segments
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    // --- SRT Parsing ---

    #[test]
    fn test_parse_srt_output_basic() {
        let srt = "1\n00:00:01,000 --> 00:00:04,000\nHello world\n\n2\n00:00:05,000 --> 00:00:08,500\nThis is a test\n\n";
        let entries = parse_srt_output(srt);
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].index, 1);
        assert!((entries[0].start_time - 1.0).abs() < 0.001);
        assert!((entries[0].end_time - 4.0).abs() < 0.001);
        assert_eq!(entries[0].text, "Hello world");
        assert_eq!(entries[1].index, 2);
        assert_eq!(entries[1].text, "This is a test");
    }

    #[test]
    fn test_parse_srt_output_multiline() {
        let srt = "1\n00:00:01,000 --> 00:00:04,000\nLine one\nLine two\n\n";
        let entries = parse_srt_output(srt);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].text, "Line one Line two");
    }

    #[test]
    fn test_parse_srt_output_no_trailing_newline() {
        let srt = "1\n00:00:01,000 --> 00:00:04,000\nHello";
        let entries = parse_srt_output(srt);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].text, "Hello");
    }

    #[test]
    fn test_parse_srt_time() {
        assert!((parse_srt_time("00:01:30,500") - 90.5).abs() < 0.001);
        assert!((parse_srt_time("01:00:00,000") - 3600.0).abs() < 0.001);
        assert!((parse_srt_time("00:00:00,000") - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_parse_srt_empty() {
        let entries = parse_srt_output("");
        assert!(entries.is_empty());
    }

    // --- Scene Detection ---

    #[test]
    fn test_parse_scene_detect_output() {
        let output = "[Parsed_showinfo_1 @ 0x1234] n:1 pts:1234 pts_time:5.123 pos:12345 fmt:yuv420p\n\
                       [Parsed_showinfo_1 @ 0x1234] n:2 pts:5678 pts_time:10.567 pos:56789 fmt:yuv420p\n";
        let points = parse_scene_detect_output(output, 0.3);
        assert_eq!(points.len(), 2);
        assert!((points[0].timestamp - 5.123).abs() < 0.001);
        assert!((points[1].timestamp - 10.567).abs() < 0.001);
    }

    #[test]
    fn test_build_scene_detect_args() {
        let args = build_scene_detect_args("/tmp/video.mp4", 0.3);
        assert_eq!(args[0], "-i");
        assert_eq!(args[1], "/tmp/video.mp4");
        assert_eq!(args[2], "-vf");
        assert!(args[3].contains("gt(scene,0.3)"));
        assert!(args[3].contains("showinfo"));
    }

    // --- Chromakey ---

    #[test]
    fn test_build_chromakey_filter_green() {
        let config = ChromakeyConfig {
            color: "0x00ff00".to_string(),
            similarity: 0.3,
            blend: 0.1,
        };
        let filter = build_chromakey_filter(&config);
        assert_eq!(filter, "chromakey=color=0x00ff00:similarity=0.30:blend=0.10");
    }

    #[test]
    fn test_build_chromakey_filter_blue() {
        let config = ChromakeyConfig {
            color: "0x0000ff".to_string(),
            similarity: 0.5,
            blend: 0.2,
        };
        let filter = build_chromakey_filter(&config);
        assert_eq!(filter, "chromakey=color=0x0000ff:similarity=0.50:blend=0.20");
    }

    // --- Enhancement ---

    #[test]
    fn test_build_enhancement_sharpen_only() {
        let config = EnhancementConfig {
            sharpen: Some(SharpenConfig {
                luma_x: 5,
                luma_y: 5,
                luma_amount: 1.0,
            }),
            denoise: None,
            upscale: None,
        };
        let filter = build_enhancement_filters(&config);
        assert_eq!(filter, "unsharp=5:5:1.0:5:5:1.0");
    }

    #[test]
    fn test_build_enhancement_denoise_nlmeans() {
        let config = EnhancementConfig {
            sharpen: None,
            denoise: Some(DenoiseConfig {
                strength: 3.0,
                filter_type: "nlmeans".to_string(),
            }),
            upscale: None,
        };
        let filter = build_enhancement_filters(&config);
        assert_eq!(filter, "nlmeans=s=3:p=7:r=15");
    }

    #[test]
    fn test_build_enhancement_denoise_hqdn3d() {
        let config = EnhancementConfig {
            sharpen: None,
            denoise: Some(DenoiseConfig {
                strength: 4.0,
                filter_type: "hqdn3d".to_string(),
            }),
            upscale: None,
        };
        let filter = build_enhancement_filters(&config);
        assert_eq!(filter, "hqdn3d=4.0:4.0:8.0:8.0");
    }

    #[test]
    fn test_build_enhancement_upscale() {
        let config = EnhancementConfig {
            sharpen: None,
            denoise: None,
            upscale: Some(UpscaleConfig {
                scale_factor: 2.0,
            }),
        };
        let filter = build_enhancement_filters(&config);
        assert_eq!(filter, "scale=iw*2.0:ih*2.0:flags=lanczos");
    }

    #[test]
    fn test_build_enhancement_combined() {
        let config = EnhancementConfig {
            sharpen: Some(SharpenConfig {
                luma_x: 5,
                luma_y: 5,
                luma_amount: 1.5,
            }),
            denoise: Some(DenoiseConfig {
                strength: 3.0,
                filter_type: "hqdn3d".to_string(),
            }),
            upscale: Some(UpscaleConfig {
                scale_factor: 1.5,
            }),
        };
        let filter = build_enhancement_filters(&config);
        assert_eq!(
            filter,
            "unsharp=5:5:1.5:5:5:1.5,hqdn3d=3.0:3.0:6.0:6.0,scale=iw*1.5:ih*1.5:flags=lanczos"
        );
    }

    #[test]
    fn test_build_enhancement_empty() {
        let config = EnhancementConfig {
            sharpen: None,
            denoise: None,
            upscale: None,
        };
        let filter = build_enhancement_filters(&config);
        assert!(filter.is_empty());
    }

    // --- Silence Detection ---

    #[test]
    fn test_build_silence_detect_args() {
        let args = build_silence_detect_args("/tmp/video.mp4", -30.0, 2.0);
        assert_eq!(args[0], "-i");
        assert_eq!(args[1], "/tmp/video.mp4");
        assert_eq!(args[2], "-af");
        assert!(args[3].contains("silencedetect"));
        assert!(args[3].contains("-30dB"));
        assert!(args[3].contains("d=2"));
    }

    #[test]
    fn test_parse_silence_detect_output_basic() {
        let output = "[silencedetect @ 0x123] silence_start: 1.5\n\
                       [silencedetect @ 0x123] silence_end: 4.0 | silence_duration: 2.5\n\
                       [silencedetect @ 0x123] silence_start: 10.0\n\
                       [silencedetect @ 0x123] silence_end: 15.0 | silence_duration: 5.0\n";
        let segments = parse_silence_detect_output(output);
        assert_eq!(segments.len(), 2);
        assert!((segments[0].start_time - 1.5).abs() < 0.001);
        assert!((segments[0].end_time - 4.0).abs() < 0.001);
        assert!((segments[0].duration - 2.5).abs() < 0.001);
        assert!((segments[1].start_time - 10.0).abs() < 0.001);
        assert!((segments[1].end_time - 15.0).abs() < 0.001);
        assert!((segments[1].duration - 5.0).abs() < 0.001);
    }

    #[test]
    fn test_parse_silence_detect_output_empty() {
        let segments = parse_silence_detect_output("");
        assert!(segments.is_empty());
    }

    // --- Serialization ---

    #[test]
    fn test_whisper_config_serialization() {
        let config = WhisperConfig {
            language: "ja".to_string(),
            model: "base".to_string(),
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: WhisperConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.language, "ja");
        assert_eq!(parsed.model, "base");
    }

    #[test]
    fn test_chromakey_config_serialization() {
        let config = ChromakeyConfig {
            color: "0x00ff00".to_string(),
            similarity: 0.3,
            blend: 0.1,
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: ChromakeyConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.color, "0x00ff00");
    }

    #[test]
    fn test_enhancement_config_serialization() {
        let config = EnhancementConfig {
            sharpen: Some(SharpenConfig {
                luma_x: 5,
                luma_y: 5,
                luma_amount: 1.0,
            }),
            denoise: None,
            upscale: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: EnhancementConfig = serde_json::from_str(&json).unwrap();
        assert!(parsed.sharpen.is_some());
        assert!(parsed.denoise.is_none());
    }

    #[test]
    fn test_silence_segment_serialization() {
        let seg = SilenceSegment {
            start_time: 1.5,
            end_time: 4.0,
            duration: 2.5,
        };
        let json = serde_json::to_string(&seg).unwrap();
        let parsed: SilenceSegment = serde_json::from_str(&json).unwrap();
        assert!((parsed.start_time - 1.5).abs() < 0.001);
    }
}
