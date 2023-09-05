// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod fc;
mod menu;
mod setup;

use app::{conf, keybindings, opened_cache, bookmarks};

fn main() {
    let context = tauri::generate_context!();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            fc::cmd::open_folder,
            fc::cmd::get_file_content,
            fc::cmd::write_file,
            fc::cmd::delete_file,
            fc::cmd::delete_folder,
            conf::cmd::get_app_conf_path,
            conf::cmd::get_app_conf,
            conf::cmd::reset_app_conf,
            conf::cmd::save_app_conf,
            conf::cmd::open_conf_window,
            keybindings::cmd::get_keyboard_infos,
            keybindings::cmd::amend_cmd,
            opened_cache::cmd::get_opened_cache,
            opened_cache::cmd::add_recent_workspace,
            opened_cache::cmd::clear_recent_workspaces,
            bookmarks::cmd::get_bookmarks,
            bookmarks::cmd::add_bookmark,
            bookmarks::cmd::edit_bookmark,
            bookmarks::cmd::remove_bookmark,
        ])
        .setup(setup::init)
        .menu(menu::generate_menu())
        .on_menu_event(menu::menu_handler)
        .run(context)
        .expect("error while running tauri application");
}
