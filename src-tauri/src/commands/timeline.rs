use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

use crate::ffmpeg::trim::{concat_videos, trim_video, ClipSegment};

/// Global progress map for timeline operations
static TIMELINE_PROGRESS: Lazy<Arc<Mutex<HashMap<String, f64>>>> =
    Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

/// Trim progress event emitted to frontend
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrimProgressEvent {
    pub process_id: String,
    pub progress: f64,
    pub status: String,
    pub error_message: Option<String>,
}

fn gen_process_id(prefix: &str) -> String {
    format!(
        "{}_{}",
        prefix,
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    )
}

/// Trim a video clip (extract a segment from start to end)
#[tauri::command]
pub async fn trim_video_clip(
    app_handle: tauri::AppHandle,
    input: String,
    output: String,
    start: f64,
    end: f64,
    quality: String,
) -> Result<String, String> {
    use tauri::Emitter;

    let process_id = gen_process_id("trim");
    let pid = process_id.clone();

    // Init progress
    if let Ok(mut map) = TIMELINE_PROGRESS.lock() {
        map.insert(pid.clone(), 0.0);
    }

    let pid_inner = pid.clone();
    let app = app_handle.clone();

    tokio::task::spawn_blocking(move || {
        let result = trim_video(&input, &output, start, end, &quality, Some(&|p: f64| {
            if let Ok(mut map) = TIMELINE_PROGRESS.lock() {
                map.insert(pid_inner.clone(), p);
            }
            let _ = app.emit(
                "timeline-progress",
                TrimProgressEvent {
                    process_id: pid_inner.clone(),
                    progress: p,
                    status: "processing".to_string(),
                    error_message: None,
                },
            );
        }));

        match result {
            Ok(()) => {
                if let Ok(mut map) = TIMELINE_PROGRESS.lock() {
                    map.insert(pid.clone(), 1.0);
                }
                let _ = app_handle.emit(
                    "timeline-progress",
                    TrimProgressEvent {
                        process_id: pid,
                        progress: 1.0,
                        status: "complete".to_string(),
                        error_message: None,
                    },
                );
            }
            Err(ref e) => {
                if let Ok(mut map) = TIMELINE_PROGRESS.lock() {
                    map.remove(&pid);
                }
                let _ = app_handle.emit(
                    "timeline-progress",
                    TrimProgressEvent {
                        process_id: pid.clone(),
                        progress: 0.0,
                        status: "error".to_string(),
                        error_message: Some(e.clone()),
                    },
                );
            }
        }

        result
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(process_id)
}

/// Concatenate multiple segments into a single output video
#[tauri::command]
pub async fn concat_video_clips(
    app_handle: tauri::AppHandle,
    segments: Vec<ClipSegment>,
    output: String,
    quality: String,
    temp_dir: String,
) -> Result<String, String> {
    use tauri::Emitter;

    let process_id = gen_process_id("concat");
    let pid = process_id.clone();

    // Ensure temp dir exists
    tokio::fs::create_dir_all(&temp_dir)
        .await
        .map_err(|e| format!("Failed to create temp dir: {}", e))?;

    let pid_inner = pid.clone();
    let app = app_handle.clone();

    tokio::task::spawn_blocking(move || {
        let result = concat_videos(&segments, &output, &quality, &temp_dir, Some(&|p: f64| {
            if let Ok(mut map) = TIMELINE_PROGRESS.lock() {
                map.insert(pid_inner.clone(), p);
            }
            let _ = app.emit(
                "timeline-progress",
                TrimProgressEvent {
                    process_id: pid_inner.clone(),
                    progress: p,
                    status: "processing".to_string(),
                    error_message: None,
                },
            );
        }));

        match result {
            Ok(()) => {
                if let Ok(mut map) = TIMELINE_PROGRESS.lock() {
                    map.insert(pid.clone(), 1.0);
                }
                let _ = app_handle.emit(
                    "timeline-progress",
                    TrimProgressEvent {
                        process_id: pid,
                        progress: 1.0,
                        status: "complete".to_string(),
                        error_message: None,
                    },
                );
            }
            Err(ref e) => {
                if let Ok(mut map) = TIMELINE_PROGRESS.lock() {
                    map.remove(&pid);
                }
                let _ = app_handle.emit(
                    "timeline-progress",
                    TrimProgressEvent {
                        process_id: pid.clone(),
                        progress: 0.0,
                        status: "error".to_string(),
                        error_message: Some(e.clone()),
                    },
                );
            }
        }

        result
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(process_id)
}

/// Get current timeline operation progress
#[tauri::command]
pub async fn get_timeline_progress(process_id: String) -> Result<f64, String> {
    let map = TIMELINE_PROGRESS
        .lock()
        .map_err(|e| format!("Lock error: {}", e))?;
    Ok(*map.get(&process_id).unwrap_or(&-1.0))
}
