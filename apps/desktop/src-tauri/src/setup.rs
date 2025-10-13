use crate::app::conf::AppConf;
use tauri::{utils::config::WebviewUrl, App, WebviewWindowBuilder};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

pub fn init(app: &mut App, opened_urls: String) -> Result<(), Box<dyn std::error::Error>> {
    let app = app.handle().clone();

    let theme = AppConf::theme_mode();

    let mut main_win = WebviewWindowBuilder::new(
        &app,
        "main".to_string(),
        WebviewUrl::App("index.html".into()),
    )
    .initialization_script(&format!("window.openedUrls = `{opened_urls}`"))
    .initialization_script(&format!("console.log(`window.openedUrl:{opened_urls}`)"))
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

    // #[cfg(not(target_os = "macos"))]
    // {
    //     main_win = main_win.decorations(false);
    // }

    let window = main_win.build().unwrap();

    // #[cfg(not(target_os = "linux"))]
    // {
    //     window.set_shadow(true);
    // }

    Ok(())
}
