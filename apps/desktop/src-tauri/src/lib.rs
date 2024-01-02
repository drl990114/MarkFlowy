mod app;
mod fc;
mod menu;
mod search;
mod setup;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync;

use app::{bookmarks, conf, extensions, keybindings, opened_cache};
use lazy_static::lazy_static;
use tauri::{Manager, Runtime};
use tracing_subscriber;

#[cfg(target_os = "macos")]
#[macro_use]
extern crate objc;

lazy_static! {
    /// FIXME Haven't found a better way to get the home dir yet, and we will optimize it later.
    /// 0 -> home_dr
    pub static ref APP_DIR: sync::Mutex<HashMap<u32, PathBuf>> = {
        let m = HashMap::new();
        sync::Mutex::new(m)
    };
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt::init();

    let context = tauri::generate_context!();
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            fc::cmd::open_folder,
            fc::cmd::get_file_content,
            fc::cmd::write_file,
            fc::cmd::delete_file,
            fc::cmd::delete_folder,
            fc::cmd::file_exists,
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
            search::cmd::search_files,
            extensions::cmd::extensions_init,
        ])
        .setup(|app| {
            let home_dir_path = app.path().home_dir().expect("failed to get home dir");
            APP_DIR.lock().unwrap().insert(0, home_dir_path);
            setup::init(app).expect("failed to setup app");

            menu::generate_menu(app).expect("failed to generate menu");

            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}


#[cfg(target_os = "macos")]
use cocoa::appkit::{NSWindow, NSWindowStyleMask, NSWindowTitleVisibility};
#[cfg(target_os = "macos")]
use objc::runtime::YES;

pub trait WindowExt {
    #[cfg(target_os = "macos")]
    fn set_transparent_titlebar(&self, title_transparent: bool, remove_toolbar: bool);
}

impl<R: Runtime> WindowExt for tauri::Window<R> {
    #[cfg(target_os = "macos")]
    fn set_transparent_titlebar(&self, title_transparent: bool, remove_tool_bar: bool) {
        use cocoa::appkit::NSWindowButton;

        unsafe {
            let id = self.ns_window().unwrap() as cocoa::base::id;
            NSWindow::setTitlebarAppearsTransparent_(id, cocoa::base::YES);
            let mut style_mask = id.styleMask();
            style_mask.set(
                NSWindowStyleMask::NSFullSizeContentViewWindowMask,
                title_transparent,
            );

            id.setStyleMask_(style_mask);

            if remove_tool_bar {
                let close_button = id.standardWindowButton_(NSWindowButton::NSWindowCloseButton);
                let _: () = msg_send![close_button, setHidden: YES];
                let min_button =
                    id.standardWindowButton_(NSWindowButton::NSWindowMiniaturizeButton);
                let _: () = msg_send![min_button, setHidden: YES];
                let zoom_button = id.standardWindowButton_(NSWindowButton::NSWindowZoomButton);
                let _: () = msg_send![zoom_button, setHidden: YES];
            }

            id.setTitleVisibility_(if title_transparent {
                NSWindowTitleVisibility::NSWindowTitleHidden
            } else {
                NSWindowTitleVisibility::NSWindowTitleVisible
            });

            id.setTitlebarAppearsTransparent_(if title_transparent {
                cocoa::base::YES
            } else {
                cocoa::base::NO
            });
        }
    }
}
