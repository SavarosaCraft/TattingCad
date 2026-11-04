use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::Emitter;
use tauri::Manager;

// ── Opening .tatcad files from the system (session 60) ─────────────────────
// Double-click / "Open with" on desktop:
//   - Windows / Linux start the app with the file as a command-line
//     argument. If TattingCAD is already running, the single-instance
//     plugin stops the second copy and hands its arguments to this one.
//   - macOS sends a RunEvent::Opened instead (see the end of run()).
// The page (tattingindex.tsx) first listens for "open-files", then calls
// take_pending_files once. Files that arrive before that are kept here;
// after it, they are sent straight to the page as an "open-files" event.
#[derive(Default)]
struct PendingFiles(Mutex<Pending>);

#[derive(Default)]
struct Pending {
  taken: bool,       // the page has asked once — send events from now on
  files: Vec<String>,
}

/// Pattern files among command-line arguments: existing .tatcad / .json
/// files (flags like "--something" are skipped; relative paths are resolved
/// against the folder the app was started from).
#[allow(dead_code)]
fn pattern_files_from_args<I: IntoIterator<Item = String>>(args: I, cwd: &Path) -> Vec<String> {
  args
    .into_iter()
    .filter(|a| !a.starts_with('-'))
    .map(PathBuf::from)
    .filter(|p| {
      matches!(
        p.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref(),
        Some("tatcad") | Some("json")
      )
    })
    .map(|p| if p.is_relative() { cwd.join(p) } else { p })
    .filter(|p| p.is_file())
    .map(|p| p.to_string_lossy().into_owned())
    .collect()
}

/// Keep the files for the page if it hasn't asked yet, otherwise send them.
#[allow(dead_code)]
fn hand_over_files(app: &tauri::AppHandle, files: Vec<String>) {
  if files.is_empty() {
    return;
  }
  let state = app.state::<PendingFiles>();
  let mut pending = state.0.lock().unwrap();
  if pending.taken {
    drop(pending);
    let _ = app.emit("open-files", files);
  } else {
    pending.files.extend(files);
  }
}

/// Called once by the page at start: the files the app was opened with.
#[tauri::command]
fn take_pending_files(state: tauri::State<'_, PendingFiles>) -> Vec<String> {
  let mut pending = state.0.lock().unwrap();
  pending.taken = true;
  std::mem::take(&mut pending.files)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // Must be the first plugin registered (Tauri docs). A second launch —
  // e.g. double-clicking another .tatcad while TattingCAD is open — ends
  // here: bring the window forward and open the file in it.
  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
      }
      let files = pattern_files_from_args(args.into_iter().skip(1), Path::new(&cwd));
      hand_over_files(app, files);
    }));
  }

  builder = builder
    .manage(PendingFiles::default())
    .invoke_handler(tauri::generate_handler![take_pending_files])
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

      // Files this copy was started with (double-click on Windows / Linux).
      #[cfg(desktop)]
      {
        let cwd = std::env::current_dir().unwrap_or_default();
        let files = pattern_files_from_args(std::env::args().skip(1), &cwd);
        hand_over_files(app.handle(), files);
      }

      Ok(())
    });

  #[cfg(desktop)]
  {
    builder = builder.plugin(
      tauri_plugin_window_state::Builder::default().build()
    );
  }

  let app = builder
    .build(tauri::generate_context!())
    .expect("error while building tauri application");

  app.run(|app_handle, event| {
    // macOS hands files over as an event (at start and while running).
    #[cfg(target_os = "macos")]
    if let tauri::RunEvent::Opened { urls } = &event {
      let files: Vec<String> = urls
        .iter()
        .filter_map(|u| u.to_file_path().ok())
        .map(|p| p.to_string_lossy().into_owned())
        .collect();
      hand_over_files(app_handle, files);
    }
    let _ = (app_handle, event);
  });
}
