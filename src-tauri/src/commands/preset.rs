use std::path::PathBuf;

use crate::ffmpeg::PresetInfo;

/// Get the presets directory path inside the app data directory.
/// Creates the directory if it does not exist.
#[tauri::command]
pub async fn get_presets_dir(app_handle: tauri::AppHandle) -> Result<String, String> {
    let presets_dir = get_presets_path(&app_handle)?;

    if !presets_dir.exists() {
        tokio::fs::create_dir_all(&presets_dir)
            .await
            .map_err(|e| format!("Failed to create presets directory: {}", e))?;
    }

    Ok(presets_dir.to_string_lossy().to_string())
}

/// List all saved presets in the presets directory.
#[tauri::command]
pub async fn list_presets(app_handle: tauri::AppHandle) -> Result<Vec<PresetInfo>, String> {
    let presets_dir = get_presets_path(&app_handle)?;

    if !presets_dir.exists() {
        return Ok(Vec::new());
    }

    let mut entries = tokio::fs::read_dir(&presets_dir)
        .await
        .map_err(|e| format!("Failed to read presets directory: {}", e))?;

    let mut presets = Vec::new();

    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read directory entry: {}", e))?
    {
        let path = entry.path();

        // Only process .json files
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");
        if ext != "json" {
            continue;
        }

        match parse_preset_info(&path).await {
            Ok(info) => presets.push(info),
            Err(e) => {
                log::warn!("Skipping invalid preset file {:?}: {}", path, e);
            }
        }
    }

    // Sort by name
    presets.sort_by(|a, b| a.name.cmp(&b.name));

    Ok(presets)
}

/// Resolve the presets directory path from the app handle.
fn get_presets_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;

    Ok(app_data_dir.join("presets"))
}

/// Delete a saved preset file.
#[tauri::command]
pub async fn delete_preset(path: String) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);

    if !file_path.exists() {
        return Err(format!("Preset file not found: {}", path));
    }

    tokio::fs::remove_file(file_path)
        .await
        .map_err(|e| format!("Failed to delete preset: {}", e))
}

/// Parse a single preset file into PresetInfo.
async fn parse_preset_info(path: &std::path::Path) -> Result<PresetInfo, String> {
    let name = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string();

    let content = tokio::fs::read_to_string(path)
        .await
        .map_err(|e| format!("Failed to read: {}", e))?;

    let json: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| format!("Invalid JSON: {}", e))?;

    // Try to extract watermark count from the preset
    let watermark_count = json
        .get("watermarks")
        .and_then(|w| w.as_array())
        .map(|arr| arr.len())
        .unwrap_or(0);

    // Get file modification time
    let metadata = tokio::fs::metadata(path)
        .await
        .map_err(|e| format!("Failed to get metadata: {}", e))?;

    let modified = metadata
        .modified()
        .map(|t| {
            t.duration_since(std::time::UNIX_EPOCH)
                .map(|d| {
                    // Format as ISO-8601 string (simplified)
                    let secs = d.as_secs();
                    let days = secs / 86400;
                    let remaining = secs % 86400;
                    let hours = remaining / 3600;
                    let minutes = (remaining % 3600) / 60;
                    let seconds = remaining % 60;
                    // Approximate date from epoch days (not perfect but functional)
                    format!(
                        "epoch+{}d {:02}:{:02}:{:02}",
                        days, hours, minutes, seconds
                    )
                })
                .unwrap_or_else(|_| "unknown".to_string())
        })
        .unwrap_or_else(|_| "unknown".to_string());

    Ok(PresetInfo {
        name,
        path: path.to_string_lossy().to_string(),
        watermark_count,
        modified,
    })
}
