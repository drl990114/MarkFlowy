use crate::app::{conf::AppConf, window_manager};
use tauri::{App, Emitter, WebviewWindowBuilder, utils::config::WebviewUrl};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

pub fn init(app: &mut App, opened_urls: String) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.handle().clone();

    // 首先检查是否已经存在窗口
    if let Some(existing_window) = window_manager::get_last_opened_window(&app_handle) {
        let script = format!("window.openedUrls = `{opened_urls}`; console.log(`[setup.rs] Updated openedUrls to: {opened_urls}`);");
        let _ = existing_window.eval(&script);
        existing_window.emit("opened-urls", opened_urls.clone());

        // 确保窗口被聚焦
        let _ = existing_window.set_focus();
        return Ok(());
    }

    let theme = AppConf::theme_mode();

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
    .disable_drag_drop_handler()
    .inner_size(1200.0, 800.0)
    .min_inner_size(400.0, 400.0);

    #[cfg(target_os = "macos")]
    {
        main_win = main_win.title_bar_style(TitleBarStyle::Transparent);
    }

    let window = main_win.build().unwrap();

    Ok(())
}
