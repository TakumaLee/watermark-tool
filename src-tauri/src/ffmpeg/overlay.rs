use super::{MovementMode, WatermarkConfig};

/// Result of building the filter complex: the filter string and the list of input arguments
/// that need to be added before -filter_complex.
pub struct FilterComplexResult {
    /// Additional input arguments (e.g., ["-i", "watermark1.png", "-i", "watermark2.png"])
    pub input_args: Vec<String>,
    /// The filter_complex string
    pub filter_complex: String,
    /// The map argument to select the final output stream
    pub output_label: String,
}

/// Build a complete FFmpeg filter_complex for all watermarks.
///
/// The video is assumed to be input [0]. Each watermark image is an additional input
/// [1], [2], etc. The function returns the filter_complex string and the additional
/// input arguments needed.
///
/// * `watermarks` - list of watermark configs
/// * `video_width` - video width in pixels
/// * `video_height` - video height in pixels
pub fn build_filter_complex(
    watermarks: &[WatermarkConfig],
    video_width: u32,
    video_height: u32,
) -> FilterComplexResult {
    if watermarks.is_empty() {
        return FilterComplexResult {
            input_args: vec![],
            filter_complex: String::new(),
            output_label: "0:v".to_string(),
        };
    }

    let mut input_args: Vec<String> = Vec::new();
    let mut filters: Vec<String> = Vec::new();
    let total = watermarks.len();

    for (i, wm) in watermarks.iter().enumerate() {
        let input_index = i + 1; // 0 is the video input

        // Add input file argument
        input_args.push("-i".to_string());
        input_args.push(wm.image_path.clone());

        // Calculate pixel dimensions for scaling
        let wm_w = (wm.width * video_width as f64).round() as u32;
        let wm_h = (wm.height * video_height as f64).round() as u32;

        // Build per-watermark preparation chain:
        // scale -> format rgba -> apply opacity via colorchannelmixer
        let prep_label = format!("wm{}", i);
        let opacity = wm.opacity.clamp(0.0, 1.0);

        let prep_filter = format!(
            "[{input_idx}]scale={w}:{h},format=rgba,colorchannelmixer=aa={opacity}[{label}]",
            input_idx = input_index,
            w = wm_w,
            h = wm_h,
            opacity = opacity,
            label = prep_label,
        );
        filters.push(prep_filter);

        // Determine overlay expression based on movement mode
        let overlay_expr = build_overlay_expression(wm, video_width, video_height, wm_w, wm_h);

        // Build the overlay filter connecting previous output with this watermark
        let base_label = if i == 0 {
            "0:v".to_string()
        } else {
            format!("tmp{}", i - 1)
        };

        let out_label = if i == total - 1 {
            "vout".to_string()
        } else {
            format!("tmp{}", i)
        };

        let overlay_filter = format!(
            "[{base}][{wm_label}]overlay={expr}[{out}]",
            base = base_label,
            wm_label = prep_label,
            expr = overlay_expr,
            out = out_label,
        );
        filters.push(overlay_filter);
    }

    FilterComplexResult {
        input_args,
        filter_complex: filters.join(";"),
        output_label: "[vout]".to_string(),
    }
}

/// Build the overlay positioning expression for a single watermark.
fn build_overlay_expression(
    wm: &WatermarkConfig,
    video_width: u32,
    video_height: u32,
    wm_w: u32,
    wm_h: u32,
) -> String {
    match &wm.movement {
        MovementMode::Static => {
            build_static_overlay(wm.x, wm.y, video_width, video_height, wm_w, wm_h)
        }
        MovementMode::Linear { speed, direction } => {
            build_linear_overlay(wm.x, wm.y, video_width, video_height, wm_w, wm_h, *speed, direction)
        }
        MovementMode::Random {
            interval,
            fade_duration,
        } => build_random_overlay(video_width, video_height, wm_w, wm_h, *interval, *fade_duration),
    }
}

/// Static overlay: watermark stays at a fixed position.
fn build_static_overlay(
    x: f64,
    y: f64,
    video_width: u32,
    video_height: u32,
    _wm_w: u32,
    _wm_h: u32,
) -> String {
    let px_x = (x * video_width as f64).round() as i32;
    let px_y = (y * video_height as f64).round() as i32;
    format!("x={}:y={}", px_x, px_y)
}

/// Linear movement overlay: watermark moves in a direction with bounce at boundaries.
///
/// Uses FFmpeg expression variables:
/// - W, H: main (video) width/height
/// - w, h: overlay (watermark) width/height
/// - t: time in seconds
fn build_linear_overlay(
    start_x: f64,
    start_y: f64,
    video_width: u32,
    video_height: u32,
    _wm_w: u32,
    _wm_h: u32,
    speed: f64,
    direction: &str,
) -> String {
    let sx = (start_x * video_width as f64).round() as i32;
    let sy = (start_y * video_height as f64).round() as i32;

    match direction {
        "horizontal" => {
            // Bounce horizontally: use abs(mod) pattern for ping-pong
            // range = W - w (max x position), period = 2 * range / speed
            format!(
                "x='if(eq(W-w,0),0,abs(mod({sx}+t*{speed},2*(W-w))-(W-w)))':y={sy}",
                sx = sx,
                speed = speed,
                sy = sy,
            )
        }
        "vertical" => {
            // Bounce vertically
            format!(
                "x={sx}:y='if(eq(H-h,0),0,abs(mod({sy}+t*{speed},2*(H-h))-(H-h)))'",
                sx = sx,
                sy = sy,
                speed = speed,
            )
        }
        "diagonal" | _ => {
            // Bounce in both directions
            format!(
                "x='if(eq(W-w,0),0,abs(mod({sx}+t*{speed},2*(W-w))-(W-w)))':y='if(eq(H-h,0),0,abs(mod({sy}+t*{speed},2*(H-h))-(H-h)))'",
                sx = sx,
                sy = sy,
                speed = speed,
            )
        }
    }
}

/// Random appearance overlay: watermark appears at different positions periodically.
///
/// This uses the `enable=between(t,start,end)` approach. The watermark cycles through
/// several preset positions. For a truly random effect, we divide time into intervals
/// and show the watermark at pseudo-random positions using math expressions.
///
/// Since FFmpeg expressions don't have a random function that's seeded per-frame,
/// we use a pseudo-random pattern based on modular arithmetic over time.
fn build_random_overlay(
    video_width: u32,
    video_height: u32,
    wm_w: u32,
    wm_h: u32,
    interval: f64,
    fade_duration: f64,
) -> String {
    // Use a pseudo-random position based on time interval index.
    // floor(t / interval) gives us a "segment index"; we use that to vary position.
    // max_x = W - w, max_y = H - h
    let max_x = video_width.saturating_sub(wm_w).max(1);
    let max_y = video_height.saturating_sub(wm_h).max(1);

    // Pseudo-random x: mod(floor(t/interval) * large_prime, max_x)
    // Pseudo-random y: mod(floor(t/interval) * different_prime, max_y)
    // Fade: use alpha blending via enable with between for the visible window
    let visible_duration = interval - fade_duration;
    let visible_duration = if visible_duration <= 0.0 {
        interval * 0.8
    } else {
        visible_duration
    };

    format!(
        "x='mod(floor(t/{interval})*7919,{max_x})':y='mod(floor(t/{interval})*6271,{max_y})':enable='between(mod(t,{interval}),0,{visible})'",
        interval = interval,
        max_x = max_x,
        max_y = max_y,
        visible = visible_duration,
    )
}

/// Map quality preset name to FFmpeg CRF value and encoding preset.
pub fn quality_to_crf(quality: &str) -> (u32, &'static str) {
    match quality {
        "original" => (0, "veryslow"),  // lossless
        "high" => (18, "slow"),
        "medium" => (23, "medium"),
        "low" => (28, "fast"),
        _ => (23, "medium"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_static_wm() -> WatermarkConfig {
        WatermarkConfig {
            image_path: "/tmp/logo.png".to_string(),
            x: 0.1,
            y: 0.1,
            width: 0.2,
            height: 0.1,
            opacity: 0.8,
            movement: MovementMode::Static,
        }
    }

    #[test]
    fn test_empty_watermarks() {
        let result = build_filter_complex(&[], 1920, 1080);
        assert!(result.filter_complex.is_empty());
        assert_eq!(result.output_label, "0:v");
    }

    #[test]
    fn test_single_static_watermark() {
        let wms = vec![make_static_wm()];
        let result = build_filter_complex(&wms, 1920, 1080);
        assert!(!result.filter_complex.is_empty());
        assert_eq!(result.input_args.len(), 2); // -i, path
        assert!(result.filter_complex.contains("overlay="));
        assert!(result.filter_complex.contains("colorchannelmixer=aa=0.8"));
    }

    #[test]
    fn test_multiple_watermarks_chain() {
        let wms = vec![make_static_wm(), make_static_wm()];
        let result = build_filter_complex(&wms, 1920, 1080);
        // Should have tmp0 as intermediate label
        assert!(result.filter_complex.contains("[tmp0]"));
        assert!(result.filter_complex.contains("[vout]"));
        assert_eq!(result.input_args.len(), 4); // 2 * (-i, path)
    }

    #[test]
    fn test_quality_to_crf() {
        assert_eq!(quality_to_crf("original"), (0, "veryslow"));
        assert_eq!(quality_to_crf("high"), (18, "slow"));
        assert_eq!(quality_to_crf("medium"), (23, "medium"));
        assert_eq!(quality_to_crf("low"), (28, "fast"));
        assert_eq!(quality_to_crf("unknown"), (23, "medium"));
    }
}
