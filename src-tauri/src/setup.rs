use crate::app::conf::AppConf;
use tauri::{utils::config::WindowUrl, window::WindowBuilder, App, Theme};

pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let app = app.handle();
    let theme = AppConf::theme_mode();

    tauri::async_runtime::spawn(async move {
        let main_win = WindowBuilder::new(&app, "linebyline", WindowUrl::App("index.html".into()))
            .title("linebyline")
            .resizable(true)
            .fullscreen(false)
            .theme(Some(theme))
            .inner_size(800.0, 600.0);

        main_win.build().unwrap();
    });

    Ok(())
}
