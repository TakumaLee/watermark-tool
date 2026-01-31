pub mod batch;
pub mod overlay;
pub mod probe;

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
#[derive(Debug, Serialize, Deserialize, Clone)]
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
