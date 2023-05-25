use tauri::{utils::config::WindowUrl, window::WindowBuilder, App, TitleBarStyle, Theme};

pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let app = app.handle();

    tauri::async_runtime::spawn(async move {
        let mut main_win = WindowBuilder::new(&app, "linebyline", WindowUrl::App("index.html".into()))
            .title("linebyline")
            .resizable(true)
            .fullscreen(false)
            .theme(Theme::Light.into()) // TODO theme selected and setting
            .hidden_title(false)
            .inner_size(800.0, 600.0);

        #[cfg(target_os = "macos")]
        {
            // main_win = main_win.title_bar_style(TitleBarStyle::Overlay);
        }

        main_win.build().unwrap();
    });

    Ok(())
}
