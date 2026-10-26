// Office In 1 as an app for Windows and Android: the same web suite in the system's web view,
// plus what a web page cannot do there: the native save dialog (Android), opening links in the browser,
// and, on Windows, updating itself from the newest GitHub Release.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_opener::init());
  #[cfg(desktop)]
  let builder = builder
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init());
  builder
    .run(tauri::generate_context!())
    .expect("error while running Office In 1");
}
