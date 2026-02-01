use serde::{Deserialize, Serialize};

// ===== Filter (eq) =====

/// Filter adjustment configuration from frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilterConfig {
    /// Brightness: -1.0 to 1.0 (0 = default, maps to FFmpeg eq brightness)
    pub brightness: f64,
    /// Contrast: 0.0 to 3.0 (1.0 = default)
    pub contrast: f64,
    /// Saturation: 0.0 to 3.0 (1.0 = default)
    pub saturation: f64,
}

/// Build FFmpeg eq filter string.
/// Returns empty string if all values are default.
pub fn build_eq_filter(config: &FilterConfig) -> String {
    let is_default = (config.brightness - 0.0).abs() < 0.001
        && (config.contrast - 1.0).abs() < 0.001
        && (config.saturation - 1.0).abs() < 0.001;

    if is_default {
        return String::new();
    }

    format!(
        "eq=brightness={brightness:.3}:contrast={contrast:.3}:saturation={saturation:.3}",
        brightness = config.brightness,
        contrast = config.contrast,
        saturation = config.saturation,
    )
}

// ===== Speed =====

/// Build FFmpeg setpts filter for video speed change.
/// speed > 1 = faster, speed < 1 = slower.
pub fn build_speed_video_filter(speed: f64) -> String {
    if (speed - 1.0).abs() < 0.001 {
        return String::new();
    }
    // PTS / speed → faster when speed > 1
    format!("setpts=PTS/{:.3}", speed)
}

/// Build FFmpeg atempo filter chain for audio speed change.
/// atempo only accepts 0.5–100.0, so we chain multiple for extreme values.
pub fn build_speed_audio_filter(speed: f64) -> String {
    if (speed - 1.0).abs() < 0.001 {
        return String::new();
    }

    let mut remaining = speed;
    let mut filters = Vec::new();

    // Chain atempo filters (each can handle 0.5 to 100.0)
    while remaining > 100.0 {
        filters.push("atempo=100.0".to_string());
        remaining /= 100.0;
    }
    while remaining < 0.5 {
        filters.push("atempo=0.5".to_string());
        remaining /= 0.5;
    }
    filters.push(format!("atempo={:.3}", remaining));

    filters.join(",")
}

/// Build FFmpeg reverse filter.
pub fn build_reverse_video_filter() -> String {
    "reverse".to_string()
}

/// Build FFmpeg areverse filter.
pub fn build_reverse_audio_filter() -> String {
    "areverse".to_string()
}

// ===== PiP (Picture-in-Picture) =====

/// PiP render configuration from frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PiPRenderConfig {
    pub source_path: String,
    /// Proportional x (0-1)
    pub x: f64,
    /// Proportional y (0-1)
    pub y: f64,
    /// Proportional width (0-1)
    pub width: f64,
    /// Proportional height (0-1)
    pub height: f64,
    /// Start time in seconds
    pub start_time: f64,
    /// End time in seconds (-1 = entire duration)
    pub end_time: f64,
}

/// Result of building PiP filter
pub struct PiPFilterResult {
    /// Additional input args (e.g., ["-i", "pip.mp4"])
    pub input_args: Vec<String>,
    /// Filter chain segments to append
    pub filter_segments: Vec<String>,
    /// Number of inputs added
    pub input_count: usize,
}

/// Build PiP overlay filters.
/// `base_input_index` is the next available input index (after main video + watermarks etc.)
pub fn build_pip_filters(
    pips: &[PiPRenderConfig],
    video_width: u32,
    video_height: u32,
    base_input_index: usize,
    base_label: &str,
    video_duration: f64,
) -> PiPFilterResult {
    if pips.is_empty() {
        return PiPFilterResult {
            input_args: vec![],
            filter_segments: vec![],
            input_count: 0,
        };
    }

    let mut input_args = Vec::new();
    let mut segments = Vec::new();
    let total = pips.len();

    for (i, pip) in pips.iter().enumerate() {
        let input_idx = base_input_index + i;

        input_args.push("-i".to_string());
        input_args.push(pip.source_path.clone());

        // Scale PiP to target size
        let pip_w = (pip.width * video_width as f64).round() as u32;
        let pip_h = (pip.height * video_height as f64).round() as u32;
        let pip_x = (pip.x * video_width as f64).round() as i32;
        let pip_y = (pip.y * video_height as f64).round() as i32;

        let pip_label = format!("pip{}", i);
        let scale_segment = format!(
            "[{idx}:v]scale={w}:{h}[{label}]",
            idx = input_idx,
            w = pip_w,
            h = pip_h,
            label = pip_label,
        );
        segments.push(scale_segment);

        // Build overlay with time enable
        let in_label = if i == 0 {
            base_label.to_string()
        } else {
            format!("pipout{}", i - 1)
        };

        let out_label = if i == total - 1 {
            "pipfinal".to_string()
        } else {
            format!("pipout{}", i)
        };

        let end_time = if pip.end_time < 0.0 {
            video_duration
        } else {
            pip.end_time
        };

        let overlay_segment = format!(
            "[{base}][{pip_label}]overlay={x}:{y}:enable='between(t,{start},{end})'[{out}]",
            base = in_label,
            pip_label = pip_label,
            x = pip_x,
            y = pip_y,
            start = pip.start_time,
            end = end_time,
            out = out_label,
        );
        segments.push(overlay_segment);
    }

    PiPFilterResult {
        input_args,
        filter_segments: segments,
        input_count: pips.len(),
    }
}

// ===== Crop / Rotate / Flip =====

/// Transform configuration from frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransformConfig {
    /// Rotation: 0, 90, 180, 270
    pub rotation: u32,
    /// Flip: "none", "horizontal", "vertical", "both"
    pub flip: String,
    /// Crop region (proportional, None = no crop)
    pub crop: Option<CropConfig>,
}

/// Crop region configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CropConfig {
    /// Left offset (0-1)
    pub x: f64,
    /// Top offset (0-1)
    pub y: f64,
    /// Width (0-1)
    pub width: f64,
    /// Height (0-1)
    pub height: f64,
}

/// Build transform filters (crop, rotate, flip).
/// Returns a comma-separated filter chain string (may be empty).
pub fn build_transform_filters(
    config: &TransformConfig,
    video_width: u32,
    video_height: u32,
) -> String {
    let mut parts: Vec<String> = Vec::new();

    // Crop first (before rotation changes dimensions)
    if let Some(ref crop) = config.crop {
        let cw = (crop.width * video_width as f64).round() as u32;
        let ch = (crop.height * video_height as f64).round() as u32;
        let cx = (crop.x * video_width as f64).round() as u32;
        let cy = (crop.y * video_height as f64).round() as u32;

        if cw > 0 && ch > 0 {
            parts.push(format!("crop={}:{}:{}:{}", cw, ch, cx, cy));
        }
    }

    // Rotation
    match config.rotation {
        90 => parts.push("transpose=1".to_string()),  // 90° clockwise
        180 => {
            parts.push("transpose=1".to_string());
            parts.push("transpose=1".to_string());
        }
        270 => parts.push("transpose=2".to_string()),  // 90° counter-clockwise
        _ => {} // 0 = no rotation
    }

    // Flip
    match config.flip.as_str() {
        "horizontal" => parts.push("hflip".to_string()),
        "vertical" => parts.push("vflip".to_string()),
        "both" => {
            parts.push("hflip".to_string());
            parts.push("vflip".to_string());
        }
        _ => {} // "none"
    }

    parts.join(",")
}

// ===== Transitions (xfade) =====

/// Transition configuration from frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransitionConfig {
    /// xfade transition name (fade, slideleft, slideright, zoomin, dissolve)
    #[serde(rename = "type")]
    pub transition_type: String,
    /// Duration in seconds
    pub duration: f64,
    /// Offset in seconds where the transition starts
    pub offset: f64,
}

/// Build xfade transition filter_complex for concatenating clips with transitions.
///
/// This generates a chain like:
/// [0:v][1:v]xfade=transition=fade:duration=1:offset=X[v01];
/// [v01][2:v]xfade=transition=...:duration=Y:offset=Z[v012];
/// etc.
///
/// Returns (filter_complex_string, output_label, input_count).
/// Each clip is a separate input.
pub fn build_transition_filter(
    clip_paths: &[String],
    clip_durations: &[f64],
    transitions: &[TransitionConfig],
) -> (String, String) {
    if clip_paths.len() <= 1 || transitions.is_empty() {
        return (String::new(), "[0:v]".to_string());
    }

    let mut filters: Vec<String> = Vec::new();
    let mut accumulated_offset: f64 = 0.0;

    for (i, trans) in transitions.iter().enumerate() {
        if i >= clip_paths.len() - 1 {
            break;
        }

        let in_label1 = if i == 0 {
            "[0:v]".to_string()
        } else {
            format!("[xfade{}]", i - 1)
        };

        let in_label2 = format!("[{}:v]", i + 1);

        let max_transitions = transitions.len().min(clip_paths.len() - 1);
        let is_last = i == max_transitions - 1;
        let out_label = if is_last {
            "[vxfade]".to_string()
        } else {
            format!("[xfade{}]", i)
        };

        // Calculate offset: sum of previous clip durations minus accumulated transition durations
        accumulated_offset += clip_durations[i];
        let xfade_offset = (accumulated_offset - trans.duration).max(0.0);

        filters.push(format!(
            "{in1}{in2}xfade=transition={trans_type}:duration={dur:.3}:offset={offset:.3}{out}",
            in1 = in_label1,
            in2 = in_label2,
            trans_type = trans.transition_type,
            dur = trans.duration,
            offset = xfade_offset,
            out = out_label,
        ));

        // Account for transition overlap
        accumulated_offset -= trans.duration;
    }

    if filters.is_empty() {
        return (String::new(), "[0:v]".to_string());
    }

    (filters.join(";"), "[vxfade]".to_string())
}

/// Build audio crossfade to match xfade transitions.
pub fn build_audio_transition_filter(
    clip_count: usize,
    clip_durations: &[f64],
    transitions: &[TransitionConfig],
) -> (String, String) {
    if clip_count <= 1 || transitions.is_empty() {
        return (String::new(), "[0:a]".to_string());
    }

    let mut filters: Vec<String> = Vec::new();
    let mut accumulated_offset: f64 = 0.0;

    for (i, trans) in transitions.iter().enumerate() {
        if i >= clip_count - 1 {
            break;
        }

        let in_label1 = if i == 0 {
            "[0:a]".to_string()
        } else {
            format!("[axfade{}]", i - 1)
        };

        let in_label2 = format!("[{}:a]", i + 1);

        let max_transitions = transitions.len().min(clip_count - 1);
        let is_last = i == max_transitions - 1;
        let out_label = if is_last {
            "[axfade]".to_string()
        } else {
            format!("[axfade{}]", i)
        };

        accumulated_offset += clip_durations[i];
        let _offset = (accumulated_offset - trans.duration).max(0.0);

        filters.push(format!(
            "{in1}{in2}acrossfade=d={dur:.3}:c1=tri:c2=tri{out}",
            in1 = in_label1,
            in2 = in_label2,
            dur = trans.duration,
            out = out_label,
        ));

        accumulated_offset -= trans.duration;
    }

    if filters.is_empty() {
        return (String::new(), "[0:a]".to_string());
    }

    (filters.join(";"), "[axfade]".to_string())
}

// ===== Full Effects Filter Builder =====

/// Combined effects configuration
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EffectsConfig {
    pub filters: FilterConfig,
    pub speed: f64,
    pub reverse: bool,
    pub pip: Vec<PiPRenderConfig>,
    pub transform: TransformConfig,
}

/// Build all effect video filters as a comma-separated chain.
/// Does NOT include PiP or transitions (those need separate handling).
pub fn build_effects_video_filters(config: &EffectsConfig, video_width: u32, video_height: u32) -> String {
    let mut parts: Vec<String> = Vec::new();

    // Transform (crop/rotate/flip)
    let transform = build_transform_filters(&config.transform, video_width, video_height);
    if !transform.is_empty() {
        parts.push(transform);
    }

    // EQ filter
    let eq = build_eq_filter(&config.filters);
    if !eq.is_empty() {
        parts.push(eq);
    }

    // Speed
    let speed_v = build_speed_video_filter(config.speed);
    if !speed_v.is_empty() {
        parts.push(speed_v);
    }

    // Reverse
    if config.reverse {
        parts.push(build_reverse_video_filter());
    }

    parts.join(",")
}

/// Build all effect audio filters as a comma-separated chain.
pub fn build_effects_audio_filters(speed: f64, reverse: bool) -> String {
    let mut parts: Vec<String> = Vec::new();

    let speed_a = build_speed_audio_filter(speed);
    if !speed_a.is_empty() {
        parts.push(speed_a);
    }

    if reverse {
        parts.push(build_reverse_audio_filter());
    }

    parts.join(",")
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eq_filter_default() {
        let config = FilterConfig {
            brightness: 0.0,
            contrast: 1.0,
            saturation: 1.0,
        };
        assert_eq!(build_eq_filter(&config), "");
    }

    #[test]
    fn test_eq_filter_custom() {
        let config = FilterConfig {
            brightness: 0.1,
            contrast: 1.2,
            saturation: 1.3,
        };
        let result = build_eq_filter(&config);
        assert!(result.contains("brightness=0.100"));
        assert!(result.contains("contrast=1.200"));
        assert!(result.contains("saturation=1.300"));
    }

    #[test]
    fn test_speed_video_filter_normal() {
        assert_eq!(build_speed_video_filter(1.0), "");
    }

    #[test]
    fn test_speed_video_filter_fast() {
        let result = build_speed_video_filter(2.0);
        assert!(result.contains("setpts=PTS/2.000"));
    }

    #[test]
    fn test_speed_video_filter_slow() {
        let result = build_speed_video_filter(0.5);
        assert!(result.contains("setpts=PTS/0.500"));
    }

    #[test]
    fn test_speed_audio_filter_normal() {
        assert_eq!(build_speed_audio_filter(1.0), "");
    }

    #[test]
    fn test_speed_audio_filter_2x() {
        let result = build_speed_audio_filter(2.0);
        assert!(result.contains("atempo=2.000"));
    }

    #[test]
    fn test_speed_audio_filter_025x() {
        let result = build_speed_audio_filter(0.25);
        // 0.25 < 0.5, so needs chaining: atempo=0.5, atempo=0.5
        assert!(result.contains("atempo=0.5"));
    }

    #[test]
    fn test_transform_no_change() {
        let config = TransformConfig {
            rotation: 0,
            flip: "none".to_string(),
            crop: None,
        };
        assert_eq!(build_transform_filters(&config, 1920, 1080), "");
    }

    #[test]
    fn test_transform_rotate_90() {
        let config = TransformConfig {
            rotation: 90,
            flip: "none".to_string(),
            crop: None,
        };
        assert_eq!(build_transform_filters(&config, 1920, 1080), "transpose=1");
    }

    #[test]
    fn test_transform_rotate_180() {
        let config = TransformConfig {
            rotation: 180,
            flip: "none".to_string(),
            crop: None,
        };
        assert_eq!(
            build_transform_filters(&config, 1920, 1080),
            "transpose=1,transpose=1"
        );
    }

    #[test]
    fn test_transform_rotate_270() {
        let config = TransformConfig {
            rotation: 270,
            flip: "none".to_string(),
            crop: None,
        };
        assert_eq!(build_transform_filters(&config, 1920, 1080), "transpose=2");
    }

    #[test]
    fn test_transform_hflip() {
        let config = TransformConfig {
            rotation: 0,
            flip: "horizontal".to_string(),
            crop: None,
        };
        assert_eq!(build_transform_filters(&config, 1920, 1080), "hflip");
    }

    #[test]
    fn test_transform_vflip() {
        let config = TransformConfig {
            rotation: 0,
            flip: "vertical".to_string(),
            crop: None,
        };
        assert_eq!(build_transform_filters(&config, 1920, 1080), "vflip");
    }

    #[test]
    fn test_transform_both_flip() {
        let config = TransformConfig {
            rotation: 0,
            flip: "both".to_string(),
            crop: None,
        };
        assert_eq!(
            build_transform_filters(&config, 1920, 1080),
            "hflip,vflip"
        );
    }

    #[test]
    fn test_transform_crop() {
        let config = TransformConfig {
            rotation: 0,
            flip: "none".to_string(),
            crop: Some(CropConfig {
                x: 0.1,
                y: 0.1,
                width: 0.8,
                height: 0.8,
            }),
        };
        let result = build_transform_filters(&config, 1920, 1080);
        assert!(result.contains("crop="));
        assert!(result.contains("1536")); // 0.8 * 1920
        assert!(result.contains("864"));  // 0.8 * 1080
    }

    #[test]
    fn test_transform_crop_and_rotate() {
        let config = TransformConfig {
            rotation: 90,
            flip: "none".to_string(),
            crop: Some(CropConfig {
                x: 0.0,
                y: 0.0,
                width: 0.5,
                height: 0.5,
            }),
        };
        let result = build_transform_filters(&config, 1920, 1080);
        assert!(result.contains("crop="));
        assert!(result.contains("transpose=1"));
    }

    #[test]
    fn test_pip_filter_empty() {
        let result = build_pip_filters(&[], 1920, 1080, 1, "0:v", 60.0);
        assert!(result.filter_segments.is_empty());
        assert_eq!(result.input_count, 0);
    }

    #[test]
    fn test_pip_filter_single() {
        let pips = vec![PiPRenderConfig {
            source_path: "/tmp/pip.mp4".to_string(),
            x: 0.7,
            y: 0.7,
            width: 0.25,
            height: 0.25,
            start_time: 0.0,
            end_time: 10.0,
        }];
        let result = build_pip_filters(&pips, 1920, 1080, 2, "wmout", 60.0);
        assert_eq!(result.input_count, 1);
        assert_eq!(result.input_args.len(), 2);
        assert!(result.filter_segments[0].contains("scale="));
        assert!(result.filter_segments[1].contains("overlay="));
        assert!(result.filter_segments[1].contains("between(t,0,10)"));
        assert!(result.filter_segments[1].contains("[pipfinal]"));
    }

    #[test]
    fn test_transition_filter_single() {
        let paths = vec!["a.mp4".to_string(), "b.mp4".to_string()];
        let durations = vec![10.0, 10.0];
        let transitions = vec![TransitionConfig {
            transition_type: "fade".to_string(),
            duration: 1.0,
            offset: 0.0,
        }];
        let (filter, label) = build_transition_filter(&paths, &durations, &transitions);
        assert!(filter.contains("xfade=transition=fade"));
        assert!(filter.contains("duration=1.000"));
        assert_eq!(label, "[vxfade]");
    }

    #[test]
    fn test_transition_filter_none() {
        let paths = vec!["a.mp4".to_string()];
        let durations = vec![10.0];
        let transitions = vec![];
        let (filter, label) = build_transition_filter(&paths, &durations, &transitions);
        assert_eq!(filter, "");
        assert_eq!(label, "[0:v]");
    }

    #[test]
    fn test_effects_video_filters_combined() {
        let config = EffectsConfig {
            filters: FilterConfig {
                brightness: 0.1,
                contrast: 1.2,
                saturation: 1.0,
            },
            speed: 2.0,
            reverse: false,
            pip: vec![],
            transform: TransformConfig {
                rotation: 0,
                flip: "horizontal".to_string(),
                crop: None,
            },
        };
        let result = build_effects_video_filters(&config, 1920, 1080);
        assert!(result.contains("hflip"));
        assert!(result.contains("eq="));
        assert!(result.contains("setpts="));
    }

    #[test]
    fn test_effects_audio_filters_with_speed() {
        let result = build_effects_audio_filters(2.0, false);
        assert!(result.contains("atempo=2.000"));
    }

    #[test]
    fn test_effects_audio_filters_with_reverse() {
        let result = build_effects_audio_filters(1.0, true);
        assert_eq!(result, "areverse");
    }

    #[test]
    fn test_effects_audio_filters_speed_and_reverse() {
        let result = build_effects_audio_filters(0.5, true);
        assert!(result.contains("atempo=0.500"));
        assert!(result.contains("areverse"));
    }

    #[test]
    fn test_audio_transition_filter() {
        let durations = vec![10.0, 10.0];
        let transitions = vec![TransitionConfig {
            transition_type: "fade".to_string(),
            duration: 1.0,
            offset: 0.0,
        }];
        let (filter, label) = build_audio_transition_filter(2, &durations, &transitions);
        assert!(filter.contains("acrossfade"));
        assert_eq!(label, "[axfade]");
    }

    #[test]
    fn test_filter_config_serialization() {
        let config = FilterConfig {
            brightness: 0.1,
            contrast: 1.2,
            saturation: 0.8,
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: FilterConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.brightness, 0.1);
    }

    #[test]
    fn test_pip_config_serialization() {
        let pip = PiPRenderConfig {
            source_path: "/tmp/pip.mp4".to_string(),
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.3,
            start_time: 5.0,
            end_time: 15.0,
        };
        let json = serde_json::to_string(&pip).unwrap();
        let parsed: PiPRenderConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.source_path, "/tmp/pip.mp4");
    }

    #[test]
    fn test_transform_config_serialization() {
        let config = TransformConfig {
            rotation: 90,
            flip: "horizontal".to_string(),
            crop: Some(CropConfig {
                x: 0.1,
                y: 0.1,
                width: 0.8,
                height: 0.8,
            }),
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: TransformConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.rotation, 90);
        assert!(parsed.crop.is_some());
    }
}
