use crate::app::conf::AppConf;
use tauri::{utils::config::WindowUrl, window::WindowBuilder, App};



pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let app = app.handle();
    let theme = AppConf::theme_mode();

    tauri::async_runtime::spawn(async move {
        let main_win = WindowBuilder::new(&app, "linebyline", WindowUrl::App("index.html".into()))
            .title("linebyline")
            .resizable(true)
            .fullscreen(false)
            .theme(Some(theme))
            .inner_size(1200.0, 800.0)
            .min_inner_size(400.0, 400.0);

        // #[cfg(target_os = "macos")]
        // {
        //     main_win = main_win
        //         .title_bar_style(TitleBarStyle::Overlay)
        //         .hidden_title(true);
        // }

        main_win.build().unwrap();
    });

    Ok(())
}
