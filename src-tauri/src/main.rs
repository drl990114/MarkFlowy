// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod fc;
mod menu;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn open_folder(folder_path: &str) -> String {
    let files = fc::files_to_json(fc::read_directory(folder_path));
    files
}

#[tauri::command]
fn get_file_content(file_path: &str) -> String {
    let content = fc::read_file(file_path);
    content
}

#[tauri::command]
fn write_file(file_path: &str, content: &str) -> String {
    fc::write_file(file_path, content);
    String::from("OK")
}

fn main() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            open_folder,
            get_file_content,
            write_file
        ])
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
