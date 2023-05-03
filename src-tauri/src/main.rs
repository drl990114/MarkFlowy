// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_build::{try_build, Attributes, WindowsAttributes};
mod menu;

fn main() {
    if let Err(error) = try_build(
        Attributes::new()
            .windows_attributes(WindowsAttributes::new().window_icon_path("res/icon.ico")),
    ) {
        panic!("Error: {}", error);
    }

    let context = tauri::generate_context!();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .menu(menu::generate_menu())
        .on_menu_event(|event| match event.menu_item_id() {
            "Save" => {
                event
                    .window()
                    .emit("file_save", {})
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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello,{}!", name)
}
