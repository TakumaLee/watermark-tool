use super::WatermarkConfig;

/// Batch job item representing a single video to process.
#[derive(Debug, Clone)]
pub struct BatchItem {
    pub input_path: String,
    pub output_path: String,
}

/// Batch processing configuration.
#[derive(Debug, Clone)]
pub struct BatchConfig {
    pub items: Vec<BatchItem>,
    pub watermarks: Vec<WatermarkConfig>,
    pub quality: String,
}

/// Generate a list of (input, output) pairs from an input directory and output directory.
///
/// Scans the input directory for video files (by extension) and creates corresponding
/// output paths in the output directory.
pub fn prepare_batch_items(
    input_dir: &str,
    output_dir: &str,
    extensions: &[&str],
) -> Result<Vec<BatchItem>, String> {
    let input_path = std::path::Path::new(input_dir);
    let output_path = std::path::Path::new(output_dir);

    if !input_path.is_dir() {
        return Err(format!("Input directory does not exist: {}", input_dir));
    }

    if !output_path.exists() {
        std::fs::create_dir_all(output_path)
            .map_err(|e| format!("Failed to create output directory: {}", e))?;
    }

    let entries = std::fs::read_dir(input_path)
        .map_err(|e| format!("Failed to read input directory: {}", e))?;

    let mut items = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let path = entry.path();

        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        if extensions.iter().any(|&e| e == ext) {
            let file_name = path
                .file_name()
                .ok_or_else(|| "Invalid file name".to_string())?;
            let output_file = output_path.join(file_name);

            items.push(BatchItem {
                input_path: path.to_string_lossy().to_string(),
                output_path: output_file.to_string_lossy().to_string(),
            });
        }
    }

    items.sort_by(|a, b| a.input_path.cmp(&b.input_path));
    Ok(items)
}

/// Default video file extensions to scan for batch processing.
pub const DEFAULT_VIDEO_EXTENSIONS: &[&str] = &[
    "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "ts", "mts",
];
