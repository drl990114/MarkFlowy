use crate::app::{conf::AppConf, window_manager};
use tauri::{utils::config::WebviewUrl, App, AppHandle, Emitter, WebviewWindowBuilder};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

pub fn init(app_handle: AppHandle, opened_urls: String) -> Result<(), Box<dyn std::error::Error>> {

    // 首先检查是否已经存在窗口
    if let Some(existing_window) = window_manager::get_last_opened_window(&app_handle) {
        let script = format!("window.openedUrls = `{opened_urls}`; console.log(`[setup.rs] Updated openedUrls to: {opened_urls}`);");
        let _ = existing_window.eval(&script);
        existing_window.emit("opened-urls", opened_urls.clone());

        // 确保窗口被聚焦
        let _ = existing_window.set_focus();
        return Ok(());
    }

    let theme = AppConf::theme_mode(&app_handle.clone());

    let mut main_win = WebviewWindowBuilder::new(
        &app_handle,
        "main".to_string(),
        WebviewUrl::App("index.html".into()),
    )
    .initialization_script(&format!("window.openedUrls = `{opened_urls}`"))
    .initialization_script(&format!(
        "console.log(`[setup.rs] window.openedUrls set to: {opened_urls}`)"
    ))
    .title("MarkFlowy")
    .resizable(true)
    .fullscreen(false)
    .theme(Some(theme))
    .inner_size(1200.0, 800.0)
    .min_inner_size(400.0, 400.0);

    #[cfg(target_os = "macos")]
    {
        main_win = main_win.title_bar_style(TitleBarStyle::Transparent);
    }

    let window = main_win.build().unwrap();
    
    // 将初始窗口添加到全局窗口实例缓存中
    let window_label = window.label().to_string();
    let workspace_path = if !opened_urls.is_empty() {
        opened_urls.split(',').next().unwrap_or("").to_string()
    } else {
        "".to_string()
    };
    
    // 存储窗口实例信息到全局缓存
    if !workspace_path.is_empty() {
        use std::path::PathBuf;
        use crate::WINDOW_INSTANCES;
        
        let mut instances = WINDOW_INSTANCES.lock().unwrap();
        instances.insert(window_label, PathBuf::from(workspace_path));
    }

    Ok(())
}
