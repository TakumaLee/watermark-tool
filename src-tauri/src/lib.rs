mod commands;
mod ffmpeg;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};

fn build_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let settings_item = MenuItem::with_id(app, "open-settings", "Settings...", true, Some("CmdOrCtrl+,"))?;

    #[cfg(target_os = "macos")]
    {
        let app_submenu = Submenu::with_items(
            app,
            "watermark-tool",
            true,
            &[
                &settings_item,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::hide(app, None)?,
                &PredefinedMenuItem::hide_others(app, None)?,
                &PredefinedMenuItem::show_all(app, None)?,
                &PredefinedMenuItem::separator(app)?,
                &PredefinedMenuItem::quit(app, None)?,
            ],
        )?;
        return Menu::with_items(app, &[&app_submenu]);
    }

    #[cfg(not(target_os = "macos"))]
    {
        let tools_submenu = Submenu::with_items(app, "工具", true, &[&settings_item])?;
        return Menu::with_items(app, &[&tools_submenu]);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Write panic info to Desktop so silent crashes are diagnosable on Windows
    std::panic::set_hook(Box::new(|info| {
        let msg = format!("{}", info);
        let desktop = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_default();
        let log_path = std::path::PathBuf::from(desktop)
            .join("Desktop")
            .join("watermark-crash.log");
        let _ = std::fs::write(&log_path, &msg);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;

            // Build and set native menu
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(|app_handle, event| {
                if event.id() == "open-settings" {
                    let _ = app_handle.emit("menu:open-settings", ());
                }
            });

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
            // Timeline commands
            commands::timeline::trim_video_clip,
            commands::timeline::concat_video_clips,
            commands::timeline::get_timeline_progress,
            // Text commands
            commands::text::render_with_text,
            // Audio commands
            commands::audio::extract_audio_waveform,
            commands::audio::probe_audio_duration,
            commands::audio::render_with_audio,
            // Effects commands
            commands::effects::render_with_effects,
            commands::effects::render_with_transitions,
            // Export commands
            commands::export::export_platform_video,
            commands::export::export_gif,
            commands::export::extract_thumbnail,
            commands::export::estimate_gif_file_size,
            // AI commands
            commands::ai::check_whisper_available,
            commands::ai::whisper_transcribe,
            commands::ai::detect_scenes,
            commands::ai::detect_silence,
            commands::ai::render_with_enhancement,
            commands::ai::check_iopaint_available,
            commands::ai::remove_watermark,
            commands::ai::detect_watermark,
            // License commands
            commands::license::validate_license,
            commands::license::get_license_status,
            commands::license::clear_license,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
