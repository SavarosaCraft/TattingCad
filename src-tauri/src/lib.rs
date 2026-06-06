use tauri::Manager;
use tauri::Emitter;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let window = app.get_webview_window("main").unwrap();
      let app_handle = app.handle().clone();

      window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
          api.prevent_close();
          app_handle.emit("close-requested", "").unwrap();
        }
      });

      Ok(())
    });

  #[cfg(desktop)]
  {
    builder = builder.plugin(
      tauri_plugin_window_state::Builder::default().build()
    );
  }

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}