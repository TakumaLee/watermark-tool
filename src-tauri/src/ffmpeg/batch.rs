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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_prepare_batch_items_nonexistent_input() {
        let result = prepare_batch_items("/nonexistent/path", "/tmp/output", &["mp4"]);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn test_prepare_batch_items_with_files() {
        // Create temp directories and files
        let tmp = std::env::temp_dir().join("watermark_batch_test");
        let input_dir = tmp.join("input");
        let output_dir = tmp.join("output");

        // Clean up from previous runs
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&input_dir).unwrap();

        // Create test files
        fs::write(input_dir.join("video1.mp4"), b"fake").unwrap();
        fs::write(input_dir.join("video2.mkv"), b"fake").unwrap();
        fs::write(input_dir.join("readme.txt"), b"not a video").unwrap();

        let result = prepare_batch_items(
            input_dir.to_str().unwrap(),
            output_dir.to_str().unwrap(),
            &["mp4", "mkv"],
        );

        assert!(result.is_ok());
        let items = result.unwrap();
        assert_eq!(items.len(), 2);

        // Should be sorted
        assert!(items[0].input_path.contains("video1.mp4"));
        assert!(items[1].input_path.contains("video2.mkv"));

        // Output dir should have been created
        assert!(output_dir.exists());

        // Clean up
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_prepare_batch_items_no_matching_files() {
        let tmp = std::env::temp_dir().join("watermark_batch_test_empty");
        let input_dir = tmp.join("input");
        let output_dir = tmp.join("output");

        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&input_dir).unwrap();
        fs::write(input_dir.join("document.pdf"), b"not a video").unwrap();

        let result = prepare_batch_items(
            input_dir.to_str().unwrap(),
            output_dir.to_str().unwrap(),
            &["mp4"],
        );

        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_default_video_extensions() {
        assert!(DEFAULT_VIDEO_EXTENSIONS.contains(&"mp4"));
        assert!(DEFAULT_VIDEO_EXTENSIONS.contains(&"mkv"));
        assert!(DEFAULT_VIDEO_EXTENSIONS.contains(&"mov"));
        assert!(!DEFAULT_VIDEO_EXTENSIONS.contains(&"pdf"));
    }

    #[test]
    fn test_batch_config_creation() {
        let config = BatchConfig {
            items: vec![BatchItem {
                input_path: "/tmp/in.mp4".to_string(),
                output_path: "/tmp/out.mp4".to_string(),
            }],
            watermarks: vec![],
            quality: "high".to_string(),
        };
        assert_eq!(config.items.len(), 1);
        assert_eq!(config.quality, "high");
    }
}
