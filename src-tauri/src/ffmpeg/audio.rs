use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};

/// Audio waveform peaks extracted from a video/audio file.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WaveformPeaks {
    pub peaks: Vec<f32>,
    pub sample_rate: u32,
    pub duration: f64,
}

/// BGM render configuration from the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BgmRenderConfig {
    pub file_path: String,
    /// Volume as percentage (0-200)
    pub volume: f64,
    /// When the BGM starts on the timeline (seconds)
    pub start_offset: f64,
    /// Trim start within the BGM file (seconds)
    pub trim_start: f64,
    /// Trim end within the BGM file (seconds, -1 = end)
    pub trim_end: f64,
    /// Fade in duration (seconds)
    pub fade_in: f64,
    /// Fade out duration (seconds)
    pub fade_out: f64,
    /// Whether this BGM is muted
    pub is_muted: bool,
}

/// Clip-level volume override.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClipVolumeConfig {
    /// Start time of the clip in the output (seconds)
    pub start_time: f64,
    /// End time of the clip in the output (seconds)
    pub end_time: f64,
    /// Volume percentage (0-200)
    pub volume: f64,
    /// Whether muted
    pub is_muted: bool,
}

/// Audio render configuration from the frontend.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AudioRenderConfig {
    /// Main volume as percentage (0-200)
    pub main_volume: f64,
    /// Whether main audio is muted
    pub main_muted: bool,
    /// Fade in duration for main audio (seconds)
    pub fade_in_duration: f64,
    /// Fade out duration for main audio (seconds)
    pub fade_out_duration: f64,
    /// BGM items
    pub bgm_items: Vec<BgmRenderConfig>,
    /// Per-clip volume overrides
    pub clip_volumes: Vec<ClipVolumeConfig>,
}

/// Extract audio waveform peaks from a video/audio file using FFmpeg.
///
/// Process: FFmpeg → PCM s16le mono → downsample to `target_peaks` values.
pub fn extract_waveform(input_path: &str, target_peaks: usize) -> Result<WaveformPeaks, String> {
    // First, probe duration
    let duration = probe_audio_duration(input_path)?;
    if duration <= 0.0 {
        return Err("Audio duration is zero".to_string());
    }

    // Extract PCM data: mono, 8kHz, signed 16-bit little-endian
    let sample_rate: u32 = 8000;
    let sr_str = sample_rate.to_string();
    let args = vec![
        "-i", input_path,
        "-vn",
        "-ac", "1",
        "-ar", &sr_str,
        "-f", "s16le",
        "-acodec", "pcm_s16le",
        "pipe:1",
    ];

    let output = Command::new(super::ffmpeg_path())
        .args(&args)
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .map_err(|e| format!("Failed to run ffmpeg for waveform: {}", e))?;

    if !output.status.success() {
        return Err("FFmpeg waveform extraction failed".to_string());
    }

    let pcm_data = &output.stdout;
    let sample_count = pcm_data.len() / 2; // 16-bit = 2 bytes per sample

    if sample_count == 0 {
        return Ok(WaveformPeaks {
            peaks: vec![0.0; target_peaks],
            sample_rate,
            duration,
        });
    }

    // Convert bytes to samples and compute peaks
    let samples_per_peak = (sample_count as f64 / target_peaks as f64).max(1.0) as usize;
    let mut peaks: Vec<f32> = Vec::with_capacity(target_peaks);

    for i in 0..target_peaks {
        let start = i * samples_per_peak;
        let end = ((i + 1) * samples_per_peak).min(sample_count);

        if start >= sample_count {
            peaks.push(0.0);
            continue;
        }

        let mut max_val: f32 = 0.0;
        for j in start..end {
            let byte_offset = j * 2;
            if byte_offset + 1 < pcm_data.len() {
                let sample = i16::from_le_bytes([pcm_data[byte_offset], pcm_data[byte_offset + 1]]);
                let normalized = (sample as f32).abs() / 32768.0;
                if normalized > max_val {
                    max_val = normalized;
                }
            }
        }
        peaks.push(max_val);
    }

    Ok(WaveformPeaks {
        peaks,
        sample_rate,
        duration,
    })
}

/// Probe audio duration using ffprobe.
fn probe_audio_duration(input_path: &str) -> Result<f64, String> {
    let output = Command::new(super::ffprobe_path())
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            input_path,
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        return Err("ffprobe failed to read audio info".to_string());
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    let json: serde_json::Value = serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    let duration = json["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    Ok(duration)
}

/// Build audio filter arguments for FFmpeg rendering.
///
/// Returns (extra_input_args, audio_filter_complex_or_af).
/// If BGMs are present, uses -filter_complex for mixing.
/// Otherwise, uses -af for simple audio filters.
pub fn build_audio_filters(
    config: &AudioRenderConfig,
    video_duration: f64,
) -> AudioFilterResult {
    let has_bgm = config.bgm_items.iter().any(|b| !b.is_muted);

    if config.main_muted && !has_bgm {
        // Completely mute audio — no audio output
        return AudioFilterResult {
            input_args: vec![],
            filter_args: vec!["-an".to_string()],
            needs_audio_map: false,
        };
    }

    if !has_bgm {
        // Simple case: only main audio with volume/fade adjustments
        let af = build_main_audio_filter(config, video_duration);
        if af.is_empty() {
            return AudioFilterResult {
                input_args: vec![],
                filter_args: vec![],
                needs_audio_map: false,
            };
        }
        return AudioFilterResult {
            input_args: vec![],
            filter_args: vec!["-af".to_string(), af],
            needs_audio_map: false,
        };
    }

    // Complex case: BGM mixing
    build_bgm_mix_filter(config, video_duration)
}

/// Result of building audio filters.
pub struct AudioFilterResult {
    /// Extra input arguments (e.g., -i bgm1.mp3 -i bgm2.mp3)
    pub input_args: Vec<String>,
    /// Filter arguments (-af "..." or -filter_complex "...")
    pub filter_args: Vec<String>,
    /// Whether we need explicit audio mapping
    pub needs_audio_map: bool,
}

/// Build simple main audio filter (no BGM).
fn build_main_audio_filter(config: &AudioRenderConfig, video_duration: f64) -> String {
    let mut filters: Vec<String> = Vec::new();

    // Main volume
    if config.main_muted {
        filters.push("volume=0".to_string());
    } else if (config.main_volume - 100.0).abs() > 0.01 {
        let vol = config.main_volume / 100.0;
        filters.push(format!("volume={:.2}", vol));
    }

    // Per-clip volume overrides (mute segments)
    for clip_vol in &config.clip_volumes {
        if clip_vol.is_muted {
            filters.push(format!(
                "volume=enable='between(t,{:.3},{:.3})':volume=0",
                clip_vol.start_time, clip_vol.end_time
            ));
        } else if (clip_vol.volume - 100.0).abs() > 0.01 {
            let vol = clip_vol.volume / 100.0;
            filters.push(format!(
                "volume=enable='between(t,{:.3},{:.3})':volume={:.2}",
                clip_vol.start_time, clip_vol.end_time, vol
            ));
        }
    }

    // Fade in
    if config.fade_in_duration > 0.0 {
        filters.push(format!("afade=t=in:d={:.3}", config.fade_in_duration));
    }

    // Fade out
    if config.fade_out_duration > 0.0 && video_duration > config.fade_out_duration {
        let start = video_duration - config.fade_out_duration;
        filters.push(format!(
            "afade=t=out:st={:.3}:d={:.3}",
            start, config.fade_out_duration
        ));
    }

    filters.join(",")
}

/// Build complex filter for BGM mixing.
fn build_bgm_mix_filter(
    config: &AudioRenderConfig,
    video_duration: f64,
) -> AudioFilterResult {
    let mut input_args: Vec<String> = Vec::new();
    let mut filter_parts: Vec<String> = Vec::new();
    let mut mix_inputs: Vec<String> = Vec::new();

    // Input index offset: 0 = video, so BGMs start at index 1 (or higher if watermarks exist)
    // We'll use placeholder that gets adjusted during final assembly.
    // For now, assume input index starts at 1.
    let mut input_idx = 1;

    // Process main audio
    let main_af = build_main_audio_filter(config, video_duration);
    if main_af.is_empty() {
        mix_inputs.push("[0:a]".to_string());
    } else {
        filter_parts.push(format!("[0:a]{af}[amain]", af = main_af));
        mix_inputs.push("[amain]".to_string());
    }

    // Process each non-muted BGM
    for (i, bgm) in config.bgm_items.iter().enumerate() {
        if bgm.is_muted {
            continue;
        }

        input_args.push("-i".to_string());
        input_args.push(bgm.file_path.clone());

        let bgm_label = format!("bgm{}", i);
        let input_label = format!("[{}:a]", input_idx);
        input_idx += 1;

        let mut bgm_filters: Vec<String> = Vec::new();

        // Trim BGM
        if bgm.trim_start > 0.0 || bgm.trim_end > 0.0 {
            let end = if bgm.trim_end < 0.0 {
                "".to_string()
            } else {
                format!(":end={:.3}", bgm.trim_end)
            };
            bgm_filters.push(format!("atrim=start={:.3}{}", bgm.trim_start, end));
            bgm_filters.push("asetpts=PTS-STARTPTS".to_string());
        }

        // Volume
        if (bgm.volume - 100.0).abs() > 0.01 {
            let vol = bgm.volume / 100.0;
            bgm_filters.push(format!("volume={:.2}", vol));
        }

        // Fade in
        if bgm.fade_in > 0.0 {
            bgm_filters.push(format!("afade=t=in:d={:.3}", bgm.fade_in));
        }

        // Fade out — calculate based on trimmed duration
        if bgm.fade_out > 0.0 {
            // We need the effective BGM duration after trimming
            // This will be handled by FFmpeg; we set the fade out relative to the end
            // Using afade with st (start time) relative to the trimmed audio
            bgm_filters.push(format!("afade=t=out:d={:.3}", bgm.fade_out));
        }

        // Delay for start offset
        if bgm.start_offset > 0.0 {
            let delay_ms = (bgm.start_offset * 1000.0).round() as i64;
            bgm_filters.push(format!("adelay={}|{}", delay_ms, delay_ms));
        }

        if bgm_filters.is_empty() {
            mix_inputs.push(format!("[{}]", bgm_label));
            filter_parts.push(format!("{}anull[{}]", input_label, bgm_label));
        } else {
            filter_parts.push(format!(
                "{}{}[{}]",
                input_label,
                bgm_filters.join(","),
                bgm_label
            ));
            mix_inputs.push(format!("[{}]", bgm_label));
        }
    }

    // Mix all audio streams
    let mix_count = mix_inputs.len();
    if mix_count <= 1 {
        // Only main audio, no BGM actually active
        let main_af = build_main_audio_filter(config, video_duration);
        if main_af.is_empty() {
            return AudioFilterResult {
                input_args: vec![],
                filter_args: vec![],
                needs_audio_map: false,
            };
        }
        return AudioFilterResult {
            input_args: vec![],
            filter_args: vec!["-af".to_string(), main_af],
            needs_audio_map: false,
        };
    }

    let mix_input_str = mix_inputs.join("");
    filter_parts.push(format!(
        "{}amix=inputs={}:duration=first:dropout_transition=2[aout]",
        mix_input_str, mix_count
    ));

    let filter_complex = filter_parts.join(";");

    AudioFilterResult {
        input_args,
        filter_args: vec![
            "-filter_complex".to_string(),
            filter_complex,
            "-map".to_string(),
            "0:v".to_string(),
            "-map".to_string(),
            "[aout]".to_string(),
        ],
        needs_audio_map: true,
    }
}

/// Build audio filter string for integration with video filters.
/// When used with -filter_complex that already has video filters,
/// audio filters need to be integrated differently.
pub fn build_audio_af_string(config: &AudioRenderConfig, video_duration: f64) -> String {
    build_main_audio_filter(config, video_duration)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_probe_audio_duration_invalid() {
        let result = probe_audio_duration("/nonexistent/file.mp4");
        assert!(result.is_err());
    }

    #[test]
    fn test_build_main_audio_filter_default() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: false,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![],
            clip_volumes: vec![],
        };
        let filter = build_main_audio_filter(&config, 60.0);
        assert!(filter.is_empty());
    }

    #[test]
    fn test_build_main_audio_filter_volume() {
        let config = AudioRenderConfig {
            main_volume: 150.0,
            main_muted: false,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![],
            clip_volumes: vec![],
        };
        let filter = build_main_audio_filter(&config, 60.0);
        assert!(filter.contains("volume=1.50"));
    }

    #[test]
    fn test_build_main_audio_filter_muted() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: true,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![],
            clip_volumes: vec![],
        };
        let filter = build_main_audio_filter(&config, 60.0);
        assert!(filter.contains("volume=0"));
    }

    #[test]
    fn test_build_main_audio_filter_fade() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: false,
            fade_in_duration: 2.0,
            fade_out_duration: 3.0,
            bgm_items: vec![],
            clip_volumes: vec![],
        };
        let filter = build_main_audio_filter(&config, 60.0);
        assert!(filter.contains("afade=t=in:d=2.000"));
        assert!(filter.contains("afade=t=out:st=57.000:d=3.000"));
    }

    #[test]
    fn test_build_main_audio_filter_clip_volumes() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: false,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![],
            clip_volumes: vec![
                ClipVolumeConfig {
                    start_time: 5.0,
                    end_time: 10.0,
                    volume: 100.0,
                    is_muted: true,
                },
            ],
        };
        let filter = build_main_audio_filter(&config, 60.0);
        assert!(filter.contains("volume=enable='between(t,5.000,10.000)':volume=0"));
    }

    #[test]
    fn test_build_audio_filters_all_muted() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: true,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![],
            clip_volumes: vec![],
        };
        let result = build_audio_filters(&config, 60.0);
        assert!(result.filter_args.contains(&"-an".to_string()));
    }

    #[test]
    fn test_build_audio_filters_simple() {
        let config = AudioRenderConfig {
            main_volume: 80.0,
            main_muted: false,
            fade_in_duration: 1.0,
            fade_out_duration: 0.0,
            bgm_items: vec![],
            clip_volumes: vec![],
        };
        let result = build_audio_filters(&config, 60.0);
        assert!(result.filter_args.contains(&"-af".to_string()));
        assert!(!result.needs_audio_map);
    }

    #[test]
    fn test_build_bgm_mix_filter() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: false,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![BgmRenderConfig {
                file_path: "/tmp/bgm.mp3".to_string(),
                volume: 50.0,
                start_offset: 5.0,
                trim_start: 0.0,
                trim_end: -1.0,
                fade_in: 2.0,
                fade_out: 3.0,
                is_muted: false,
            }],
            clip_volumes: vec![],
        };
        let result = build_audio_filters(&config, 60.0);
        assert!(result.needs_audio_map);
        assert!(result.input_args.contains(&"/tmp/bgm.mp3".to_string()));
        // Check filter_complex contains amix
        let fc = result.filter_args.join(" ");
        assert!(fc.contains("amix=inputs=2"));
        assert!(fc.contains("volume=0.50"));
        assert!(fc.contains("afade=t=in:d=2.000"));
        assert!(fc.contains("adelay=5000|5000"));
    }

    #[test]
    fn test_build_bgm_mix_filter_muted_bgm_ignored() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: false,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![BgmRenderConfig {
                file_path: "/tmp/bgm.mp3".to_string(),
                volume: 50.0,
                start_offset: 0.0,
                trim_start: 0.0,
                trim_end: -1.0,
                fade_in: 0.0,
                fade_out: 0.0,
                is_muted: true,
            }],
            clip_volumes: vec![],
        };
        let result = build_audio_filters(&config, 60.0);
        // Muted BGM should not produce complex filter
        assert!(!result.needs_audio_map);
    }

    #[test]
    fn test_build_bgm_trim() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: false,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![BgmRenderConfig {
                file_path: "/tmp/bgm.mp3".to_string(),
                volume: 100.0,
                start_offset: 0.0,
                trim_start: 10.0,
                trim_end: 30.0,
                fade_in: 0.0,
                fade_out: 0.0,
                is_muted: false,
            }],
            clip_volumes: vec![],
        };
        let result = build_audio_filters(&config, 60.0);
        let fc = result.filter_args.join(" ");
        assert!(fc.contains("atrim=start=10.000:end=30.000"));
        assert!(fc.contains("asetpts=PTS-STARTPTS"));
    }

    #[test]
    fn test_audio_render_config_serialization() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: false,
            fade_in_duration: 2.0,
            fade_out_duration: 3.0,
            bgm_items: vec![],
            clip_volumes: vec![],
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: AudioRenderConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.main_volume, 100.0);
        assert_eq!(parsed.fade_in_duration, 2.0);
    }

    #[test]
    fn test_clip_volume_override() {
        let config = AudioRenderConfig {
            main_volume: 100.0,
            main_muted: false,
            fade_in_duration: 0.0,
            fade_out_duration: 0.0,
            bgm_items: vec![],
            clip_volumes: vec![
                ClipVolumeConfig {
                    start_time: 0.0,
                    end_time: 5.0,
                    volume: 50.0,
                    is_muted: false,
                },
            ],
        };
        let filter = build_main_audio_filter(&config, 60.0);
        assert!(filter.contains("volume=enable='between(t,0.000,5.000)':volume=0.50"));
    }
}
