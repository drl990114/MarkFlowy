#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod app;
mod fc;
mod menu;
mod search;
mod setup;
mod font;
mod task_system;

use std::env;
use std::path::PathBuf;
use std::sync;
use std::{collections::HashMap, sync::Mutex};

use app::{bookmarks, conf, extensions, keybindings, opened_cache, process, themes};
use dotenv;
use lazy_static::lazy_static;
use tauri::{Manager, Runtime, State};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};
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

struct OpenedUrls(Mutex<Option<Vec<url::Url>>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 在 Linux 上禁用 DMA-BUF 渲染器
    // 否则无法在 Linux 上运行
    // 相同的bug: https://github.com/tauri-apps/tauri/issues/10702
    // 解决方案来源: https://github.com/clash-verge-rev/clash-verge-rev/blob/ae5b2cfb79423c7e76a281725209b812774367fa/src-tauri/src/lib.rs#L27-L28
    #[cfg(target_os = "linux")]
    std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");

    tracing_subscriber::fmt::init();
    dotenv::dotenv().ok();

    let context = tauri::generate_context!();

    tauri::Builder::default()
        .manage(OpenedUrls(Default::default()))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            fc::cmd::open_folder,
            fc::cmd::open_folder_async,
            fc::cmd::get_file_content,
            fc::cmd::write_file,
            fc::cmd::write_u8_array_to_file,
            fc::cmd::delete_file,
            fc::cmd::copy_file_by_from,
            fc::cmd::create_folder,
            fc::cmd::delete_folder,
            fc::cmd::file_exists,
            fc::cmd::move_files_to_target_folder,
            fc::cmd::path_join,
            fc::cmd::rename_fs,
            fc::cmd::trash_delete,
            fc::cmd::export_html_to_path,
            fc::cmd::is_dir,
            fc::cmd::get_path_name,
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
            process::app_exit,
            process::app_restart,
            themes::cmd::load_themes,
            font::cmd::font_list,
        ])
        .setup(|app: &mut tauri::App| {
            let home_dir_path = app.path().home_dir().expect("failed to get home dir");
            APP_DIR.lock().unwrap().insert(0, home_dir_path);

            let opened_urls: State<OpenedUrls> = app.state();
            let file_urls = opened_urls.inner().to_owned();

            #[cfg(any(windows, target_os = "linux"))]
            {
                // NOTICE: `args` may include URL protocol (`your-app-protocol://`) or arguments (`--`) if app supports them.
                let mut urls = Vec::new();
                for arg in env::args().skip(1) {
                    if let Ok(url) = url::Url::parse(&arg) {
                        urls.push(url);
                    }
                }

                if !urls.is_empty() {
                    file_urls.0.lock().unwrap().replace(urls);
                }
            }

            let opened_urls = if let Some(urls) = &*file_urls.0.lock().unwrap() {
                urls.iter()
                    .map(|u| {
                        urlencoding::decode(u.as_str())
                            .unwrap()
                            .replace("\\", "\\\\")
                    })
                    .collect::<Vec<_>>()
                    .join(",")
            } else {
                "".into()
            };

            setup::init(app, opened_urls).expect("failed to setup app");

            #[cfg(target_os = "macos")]
            menu::generate_menu(app).expect("failed to generate menu");

            Ok(())
        })
        .on_window_event(|window, event| {
            let app = window.app_handle();
            let _ = app.save_window_state(StateFlags::all());
        })
        .build(context)
        .unwrap()
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            match event {
                tauri::RunEvent::Opened { urls, .. } => {
                    let opened_urls = app.try_state::<OpenedUrls>();
                    if let Some(u) = opened_urls {
                        u.0.lock().unwrap().replace(urls);
                    }
                }
                _ => (),
            }
        });
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
