use crate::app::window_manager;
use tauri::{utils::config::WebviewUrl, AppHandle, Emitter};

pub fn init(
    app_handle: AppHandle,
    opened_urls: Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    // 首先检查是否已经存在窗口
    if let Some(existing_window) = window_manager::get_last_opened_window(&app_handle) {
        // The existing renderer may not have consumed its initial paths yet.
        // Merge only the pending paths; never replace its appearance/session bootstrap.
        crate::update_window_opened_urls(&existing_window, &opened_urls);
        let _ = existing_window.emit("opened-urls", opened_urls.clone());

        // 确保窗口被聚焦
        let _ = existing_window.set_focus();
        return Ok(());
    }

    let window = window_manager::build_main_window(
        &app_handle,
        "main".to_string(),
        WebviewUrl::App("index.html".into()),
        opened_urls.clone(),
    )
    .map_err(std::io::Error::other)?;

    // 将初始窗口添加到全局窗口实例缓存中
    let window_label = window.label().to_string();
    let workspace_path = opened_urls.first().cloned().unwrap_or_default();

    // 存储窗口实例信息到全局缓存
    if !workspace_path.is_empty() {
        use crate::WINDOW_INSTANCES;
        use std::path::PathBuf;

        let mut instances = WINDOW_INSTANCES
            .lock()
            .map_err(|e| format!("Failed to lock window instances: {}", e))?;
        instances.insert(window_label, PathBuf::from(workspace_path));
    }

    Ok(())
}
