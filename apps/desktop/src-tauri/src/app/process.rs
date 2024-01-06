use tauri::{AppHandle, Runtime};

#[tauri::command]
pub fn app_exit<R: Runtime>(app: AppHandle<R>, code: i32) {
    app.exit(code)
}

#[tauri::command]
pub fn app_restart<R: Runtime>(app: AppHandle<R>) {
    app.restart()
}
