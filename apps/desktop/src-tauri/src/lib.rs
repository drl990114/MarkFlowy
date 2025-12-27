#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod app;
mod fc;
mod font;
mod menu;
mod search;
mod setup;
mod task_system;

use std::env;
use std::path::PathBuf;
use std::sync;
use std::{collections::HashMap, sync::Mutex};

use app::{
    bookmarks, conf, extensions, file_watcher, keybindings, opened_cache, process, themes,
    window_manager, workspace,
};
use dotenv;
use lazy_static::lazy_static;
use tauri::{Manager, Runtime, State};
use tauri_plugin_window_state::{AppHandleExt, StateFlags};
use tracing_subscriber;

lazy_static! {
    /// FIXME Haven't found a better way to get the home dir yet, and we will optimize it later.
    /// 0 -> home_dr
    pub static ref APP_DIR: sync::Mutex<HashMap<u32, PathBuf>> = {
        let m = HashMap::new();
        sync::Mutex::new(m)
    };

    /// 窗口实例信息缓存，键为窗口标签，值为工作区路径
    pub static ref WINDOW_INSTANCES: sync::Mutex<HashMap<String, PathBuf>> = {
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
        .plugin(tauri_plugin_single_instance::init(|app_handle: &tauri::AppHandle, args: Vec<String>, cwd: String| {
            // 提取文件路径参数（args[0]是程序本身，args[1..]是传递的参数）
            let opened_urls = if args.len() > 1 {
                // 跳过程序本身，将其余参数用逗号连接
                args[1..].join(",")
            } else {
                "".to_string()
            };
            
            // 调用setup函数处理参数和窗口复用逻辑
            if let Err(e) = crate::setup::init(app_handle.clone(), opened_urls) {
                println!("单例参数处理失败: {:?}", e);
            }
        }))
        .invoke_handler(tauri::generate_handler![
            fc::cmd::open_folder,
            fc::cmd::open_folder_async,
            fc::cmd::get_file_content,
            fc::cmd::write_file,
            fc::cmd::write_u8_array_to_file,
            fc::cmd::read_u8_array_from_file,
            fc::cmd::delete_file,
            fc::cmd::copy_file_by_from,
            fc::cmd::create_folder,
            fc::cmd::delete_folder,
            fc::cmd::file_exists,
            fc::cmd::move_files_to_target_folder,
            fc::cmd::path_join,
            fc::cmd::get_md_relative_path,
            fc::cmd::rename_fs,
            fc::cmd::trash_delete,
            fc::cmd::export_html_to_path,
            fc::cmd::is_dir,
            fc::cmd::get_path_name,
            fc::cmd::get_file_normal_info,
            fc::cmd::copy_file,
            conf::cmd::get_app_conf,
            conf::cmd::reset_app_conf,
            conf::cmd::save_app_conf,
            conf::cmd::open_conf_window,
            app::window_manager::create_new_window,
            app::window_manager::get_window_instances,
            app::window_manager::update_window_path,
            app::window_manager::check_window_by_path,
            app::window_manager::focus_window_by_label,
            keybindings::cmd::get_keyboard_infos,
            keybindings::cmd::update_keybinding,
            opened_cache::cmd::get_opened_cache,
            opened_cache::cmd::add_recent_workspace,
            opened_cache::cmd::clear_recent_workspaces,
            bookmarks::cmd::get_bookmarks,
            bookmarks::cmd::add_bookmark,
            bookmarks::cmd::edit_bookmark,
            bookmarks::cmd::remove_bookmark,
            search::cmd::search_files_async,
            extensions::cmd::extensions_init,
            process::app_exit,
            process::app_restart,
            themes::cmd::load_themes,
            font::cmd::font_list,
            workspace::cmd::is_git_repository,
            file_watcher::cmd::watch_file,
            file_watcher::cmd::stop_file_watcher,
            file_watcher::cmd::stop_all_file_watchers,
            app::clipboard::get_clipboard_html,
            app::clipboard::get_clipboard_text,
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

            setup::init(app.handle().clone(), opened_urls).expect("failed to setup app");

            #[cfg(target_os = "macos")]
            menu::generate_menu(app).expect("failed to generate menu");

            Ok(())
        })
        .on_window_event(|window, event| {
            let app = window.app_handle();
            let _ = app.save_window_state(StateFlags::all());

            if let tauri::WindowEvent::Destroyed = event {
                let window_label = window.label();
                if let Ok(mut instances) = WINDOW_INSTANCES.lock() {
                    instances.remove(window_label);
                    println!(
                        "Removed window '{}' from WINDOW_INSTANCES on close",
                        window_label
                    );
                }
            }
        })
        .build(context)
        .unwrap()
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            match event {
                tauri::RunEvent::Opened { urls, .. } => {
                    let opened_urls = app.try_state::<OpenedUrls>();
                    if let Some(u) = opened_urls {
                        u.0.lock().unwrap().replace(urls.clone());
                    }

                    let urls_str = urls
                        .iter()
                        .map(|u| {
                            urlencoding::decode(u.as_str())
                                .unwrap()
                                .replace("\\", "\\\\")
                        })
                        .collect::<Vec<_>>()
                        .join(",");

                    println!("Processed URLs string: {}", urls_str);

                    if let Some(window) = window_manager::get_focused_window(app) {
                        use tauri::Emitter;
                        println!("Emitting to focused window: {}", window.label());
                        let result = window.emit("opened-urls", urls_str.clone());
                        println!("Emit result: {:?}", result);
                    } else {
                        if let Some(window) = window_manager::get_last_opened_window(app) {
                            use tauri::Emitter;
                            println!("Emitting to last opened window: {}", window.label());
                            let result = window.emit("opened-urls", urls_str.clone());
                            println!("Emit result: {:?}", result);
                        } else {
                            println!("No window found to emit event");
                        }
                    }
                }
                _ => {}
            }
        });
}
