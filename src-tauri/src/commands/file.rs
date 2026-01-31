use std::path::Path;

/// Read a file as raw bytes. Useful for loading watermark images into the frontend.
#[tauri::command]
pub async fn read_file_bytes(path: String) -> Result<Vec<u8>, String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    if !file_path.is_file() {
        return Err(format!("Not a file: {}", path));
    }

    tokio::fs::read(file_path)
        .await
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))
}

/// Save a JSON string to a file (used for preset saving).
#[tauri::command]
pub async fn save_preset(path: String, data: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    // Ensure parent directory exists
    if let Some(parent) = file_path.parent() {
        if !parent.exists() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    // Validate that data is valid JSON before saving
    serde_json::from_str::<serde_json::Value>(&data)
        .map_err(|e| format!("Invalid JSON data: {}", e))?;

    tokio::fs::write(file_path, &data)
        .await
        .map_err(|e| format!("Failed to write file '{}': {}", path, e))
}

/// Load a JSON preset file and return its content as a string.
#[tauri::command]
pub async fn load_preset(path: String) -> Result<String, String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(format!("Preset file not found: {}", path));
    }

    let content = tokio::fs::read_to_string(file_path)
        .await
        .map_err(|e| format!("Failed to read preset '{}': {}", path, e))?;

    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|e| format!("Invalid JSON in preset file: {}", e))?;

    Ok(content)
}
