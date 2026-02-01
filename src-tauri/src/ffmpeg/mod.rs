pub mod batch;
pub mod overlay;
pub mod probe;
pub mod text;
pub mod trim;

use serde::{Deserialize, Serialize};

/// Video metadata returned by ffprobe
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VideoInfo {
    pub width: u32,
    pub height: u32,
    pub duration: f64,
    pub fps: f64,
    pub codec: String,
    pub file_size: u64,
}

/// Watermark configuration sent from the frontend.
/// Coordinates and dimensions are proportional (0-1).
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatermarkConfig {
    pub image_path: String,
    /// Proportional x position (0-1)
    pub x: f64,
    /// Proportional y position (0-1)
    pub y: f64,
    /// Proportional width relative to video width (0-1)
    pub width: f64,
    /// Proportional height relative to video height (0-1)
    pub height: f64,
    /// Opacity (0-1)
    pub opacity: f64,
    /// Movement mode for the watermark
    pub movement: MovementMode,
}

/// Movement mode for a watermark overlay
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum MovementMode {
    /// Watermark stays at fixed position
    Static,
    /// Watermark moves linearly across the video
    Linear {
        /// Speed in pixels per second
        speed: f64,
        /// Direction: "horizontal", "vertical", "diagonal"
        direction: String,
    },
    /// Watermark appears at random positions periodically
    Random {
        /// Interval in seconds between position changes
        interval: f64,
        /// Fade duration in seconds for transitions
        fade_duration: f64,
    },
}

/// Preset metadata for listing
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PresetInfo {
    pub name: String,
    pub path: String,
    pub watermark_count: usize,
    pub modified: String,
}

/// Batch processing item sent from the frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchItemConfig {
    pub input_path: String,
    pub output_path: String,
}

/// Batch progress event emitted to frontend
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct BatchProgressEvent {
    /// Overall batch job id
    pub batch_id: String,
    /// Index of the current file being processed (0-based)
    pub current_index: usize,
    /// Total number of files
    pub total_count: usize,
    /// Current file's render progress (0.0 - 1.0)
    pub file_progress: f64,
    /// Status of the current file: "processing", "complete", "error"
    pub file_status: String,
    /// Error message if file_status is "error"
    pub error_message: Option<String>,
    /// Whether the entire batch is complete
    pub batch_complete: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_movement_mode_static_serialization() {
        let mode = MovementMode::Static;
        let json = serde_json::to_string(&mode).unwrap();
        assert!(json.contains(r#""type":"Static"#));
        let parsed: MovementMode = serde_json::from_str(&json).unwrap();
        assert!(matches!(parsed, MovementMode::Static));
    }

    #[test]
    fn test_movement_mode_linear_serialization() {
        let mode = MovementMode::Linear {
            speed: 120.0,
            direction: "horizontal".to_string(),
        };
        let json = serde_json::to_string(&mode).unwrap();
        assert!(json.contains(r#""type":"Linear"#));
        assert!(json.contains("120"));
        let parsed: MovementMode = serde_json::from_str(&json).unwrap();
        if let MovementMode::Linear { speed, direction } = parsed {
            assert_eq!(speed, 120.0);
            assert_eq!(direction, "horizontal");
        } else {
            panic!("Expected Linear mode");
        }
    }

    #[test]
    fn test_movement_mode_random_serialization() {
        let mode = MovementMode::Random {
            interval: 3.0,
            fade_duration: 0.5,
        };
        let json = serde_json::to_string(&mode).unwrap();
        assert!(json.contains(r#""type":"Random"#));
        let parsed: MovementMode = serde_json::from_str(&json).unwrap();
        if let MovementMode::Random {
            interval,
            fade_duration,
        } = parsed
        {
            assert_eq!(interval, 3.0);
            assert_eq!(fade_duration, 0.5);
        } else {
            panic!("Expected Random mode");
        }
    }

    #[test]
    fn test_watermark_config_serialization() {
        let config = WatermarkConfig {
            image_path: "/tmp/logo.png".to_string(),
            x: 0.1,
            y: 0.2,
            width: 0.3,
            height: 0.15,
            opacity: 0.8,
            movement: MovementMode::Static,
        };
        let json = serde_json::to_string(&config).unwrap();
        let parsed: WatermarkConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.image_path, "/tmp/logo.png");
        assert_eq!(parsed.x, 0.1);
        assert_eq!(parsed.opacity, 0.8);
    }

    #[test]
    fn test_batch_progress_event_serialization() {
        let event = BatchProgressEvent {
            batch_id: "test-batch".to_string(),
            current_index: 1,
            total_count: 5,
            file_progress: 0.75,
            file_status: "processing".to_string(),
            error_message: None,
            batch_complete: false,
        };
        let json = serde_json::to_string(&event).unwrap();
        let parsed: BatchProgressEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed, event);
    }

    #[test]
    fn test_batch_progress_event_with_error() {
        let event = BatchProgressEvent {
            batch_id: "err-batch".to_string(),
            current_index: 2,
            total_count: 3,
            file_progress: 0.0,
            file_status: "error".to_string(),
            error_message: Some("FFmpeg crashed".to_string()),
            batch_complete: false,
        };
        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("FFmpeg crashed"));
    }

    #[test]
    fn test_preset_info_serialization() {
        let info = PresetInfo {
            name: "my-preset".to_string(),
            path: "/presets/my-preset.json".to_string(),
            watermark_count: 2,
            modified: "2026-02-01".to_string(),
        };
        let json = serde_json::to_string(&info).unwrap();
        let parsed: PresetInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name, "my-preset");
        assert_eq!(parsed.watermark_count, 2);
    }

    #[test]
    fn test_video_info_serialization() {
        let info = VideoInfo {
            width: 1920,
            height: 1080,
            duration: 120.5,
            fps: 30.0,
            codec: "h264".to_string(),
            file_size: 50_000_000,
        };
        let json = serde_json::to_string(&info).unwrap();
        let parsed: VideoInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.width, 1920);
        assert_eq!(parsed.duration, 120.5);
    }
}
