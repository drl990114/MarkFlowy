// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod cmd;
mod fc;
mod menu;
mod setup;
mod app;

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
        .on_menu_event(|event| match event.menu_item_id() {
            "Save" => {
                event
                    .window()
                    .emit("file_save", {})
                    .map_err(|err| println!("{:?}", err))
                    .ok();
            }
            "About" => {
                event
                    .window()
                    .emit("dialog_setting_about", {})
                    .map_err(|err| println!("{:?}", err))
                    .ok();
            }
            "DualView" => {
                event
                    .window()
                    .emit("editor_toggle_type", "dual")
                    .map_err(|err| println!("{:?}", err))
                    .ok();
            }
            "WysiwygView" => {
                event
                    .window()
                    .emit("editor_toggle_type", "wysiwyg")
                    .map_err(|err| println!("{:?}", err))
                    .ok();
            }
            _ => {}
        })
        .run(context)
        .expect("error while running tauri application");
}
