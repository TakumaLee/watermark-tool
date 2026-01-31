mod commands;
mod ffmpeg;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // FFmpeg commands
            commands::ffmpeg::probe_video,
            commands::ffmpeg::render_video,
            commands::ffmpeg::get_render_progress,
            commands::ffmpeg::cancel_render,
            commands::ffmpeg::batch_render_video,
            // File commands
            commands::file::read_file_bytes,
            commands::file::save_preset,
            commands::file::load_preset,
            // Preset commands
            commands::preset::get_presets_dir,
            commands::preset::list_presets,
            commands::preset::delete_preset,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
