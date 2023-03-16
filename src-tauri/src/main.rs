use tauri::{CustomMenuItem, Menu, MenuItem, Submenu};
// #![cfg_attr(
//   all(not(debug_assertions), target_os = "windows"),
//   windows_subsystem = "windows"
// )]

fn main() {
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let close = CustomMenuItem::new("close".to_string(), "Close");
    let submenu = Submenu::new("test", Menu::new().add_item(quit).add_item(close));
    let hide = CustomMenuItem::new("test".to_string(), "Test");
    let menu = Menu::new()
        // let menu = Menu::os_default("test")
        .add_native_item(MenuItem::Copy)
        .add_item(hide)
        .add_submenu(submenu);
    let context = tauri::generate_context!();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet])
        .menu(menu)
        .run(context)
        .expect("error while running tauri application");
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello,{}!",name)
}
