use crate::WindowExt;
use tauri::{utils::config::WindowUrl, window::WindowBuilder, App, Runtime, TitleBarStyle, Window};

#[cfg(not(target_os = "linux"))]
use window_shadows::set_shadow;

pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let app = app.handle().clone();
    // let theme = AppConf::theme_mode();

    let mut main_win = WindowBuilder::new(&app, "markflowy", WindowUrl::App("index.html".into()))
        .title("markflowy")
        .resizable(true)
        .fullscreen(false)
        // .theme(Some(theme))
        .inner_size(1200.0, 800.0)
        .min_inner_size(400.0, 400.0);

    #[cfg(target_os = "macos")]
    {
        main_win = main_win.title_bar_style(TitleBarStyle::Overlay);
    }

    let window = main_win.build().unwrap();

    #[cfg(not(target_os = "macos"))]
    {
        main_win = main_win.decorations(false);
    }

    #[cfg(target_os = "macos")]
    window.set_transparent_titlebar(true, true);

    #[cfg(not(target_os = "linux"))]
    set_shadow(window.clone(), true).unwrap();

    Ok(())
}
