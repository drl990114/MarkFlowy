// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod cmd;
mod fc;
mod menu;
mod setup;

use app::conf;

fn main() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            cmd::open_folder,
            cmd::get_file_content,
            cmd::write_file,
            conf::cmd::get_app_conf,
            conf::cmd::reset_app_conf,
            conf::cmd::save_app_conf,
        ])
        .setup(setup::init)
        .menu(menu::generate_menu())
        .on_menu_event(menu::menu_handler)
        .run(context)
        .expect("error while running tauri application");
}
