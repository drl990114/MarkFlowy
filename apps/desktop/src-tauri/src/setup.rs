use crate::{app::conf::AppConf, WindowExt};
use tauri::{utils::config::WebviewUrl, App, Manager, Theme, WebviewWindowBuilder, Window};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let app = app.handle().clone();

    let theme = AppConf::theme_mode();

    let mut main_win =
        WebviewWindowBuilder::new(&app, "main".to_string(), WebviewUrl::App("index.html".into()))
            .title("MarkFlowy")
            .resizable(true)
            .fullscreen(false)
            .theme(Some(theme))
            .inner_size(1200.0, 800.0)
            .min_inner_size(400.0, 400.0);

    #[cfg(target_os = "macos")]
    {
        main_win = main_win
            .title_bar_style(TitleBarStyle::Transparent);
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

    // #[cfg(target_os = "macos")]
    // window.set_transparent_titlebar(true, true);

    Ok(())
}
