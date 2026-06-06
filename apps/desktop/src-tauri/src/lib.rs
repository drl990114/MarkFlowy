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

use std::path::PathBuf;
use std::sync;
use std::{collections::HashMap, sync::Mutex};
use std::{env, fs};

use app::{
    bookmarks, conf, extensions, file_watcher, keybindings, opened_cache, process, themes,
    window_manager, workspace,
};
use dotenv;
use lazy_static::lazy_static;
use tauri::{Manager, State};
use tauri_plugin_cli::CliExt;
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

fn opened_urls_to_string(urls: &[url::Url]) -> String {
    urls.iter()
        .map(|u| {
            urlencoding::decode(u.as_str())
                .unwrap()
                .replace("\\", "\\\\")
        })
        .collect::<Vec<_>>()
        .join(",")
}

fn append_opened_urls(opened_urls: &OpenedUrls, urls: &[url::Url]) -> Vec<url::Url> {
    let mut stored_urls = opened_urls.0.lock().unwrap();
    let stored_urls = stored_urls.get_or_insert_with(Vec::new);

    for url in urls {
        if !stored_urls.iter().any(|stored_url| stored_url == url) {
            stored_urls.push(url.clone());
        }
    }

    stored_urls.clone()
}

fn clear_opened_urls(opened_urls: &OpenedUrls) {
    opened_urls.0.lock().unwrap().take();
}

fn update_window_opened_urls(window: &tauri::WebviewWindow, opened_urls: &str) {
    if let Ok(script_opened_urls) = serde_json::to_string(opened_urls) {
        let _ = window.eval(&format!(
            r#"
            (() => {{
                const incoming = {script_opened_urls};
                const current = typeof window.openedUrls === 'string' && window.openedUrls
                    ? window.openedUrls.split(',')
                    : [];
                const merged = [...current, ...incoming.split(',')].filter(Boolean);
                window.openedUrls = [...new Set(merged)].join(',');
            }})();
            "#
        ));
    }
}

fn print_version() {
    println!(
        "markflowy {}",
        env!("CARGO_PKG_VERSION")
    );
}

fn print_cli_help() {
    println!(
        r#"MarkFlowy - AI-Powered Markdown Editor

Usage: markflowy [COMMAND] [OPTIONS]
       mf [COMMAND] [OPTIONS]

Commands:
  open <path>    Open a file or folder in MarkFlowy
  help           Print this help message
  version        Print version information

Options:
  -h, --help     Print help
  -V, --version  Print version

Examples:
  markflowy open /path/to/file.md
  markflowy open /path/to/folder
  markflowy help
  markflowy version

Note: Create a symlink or alias 'mf' -> 'markflowy' for shorter invocation."#
    );
}

fn is_terminal_launch() -> bool {
    std::env::var("TERM").is_ok()
}

fn path_to_file_url(path: &str, cwd: Option<&str>) -> String {
    if url::Url::parse(path).is_ok() {
        return path.to_string();
    }

    let path = PathBuf::from(path);
    let path = if path.is_absolute() {
        path
    } else {
        cwd.filter(|cwd| !cwd.is_empty())
            .map(PathBuf::from)
            .or_else(|| env::current_dir().ok())
            .unwrap_or_else(|| PathBuf::from("."))
            .join(path)
    };

    url::Url::from_file_path(&path)
        .map(|u| u.to_string())
        .unwrap_or_else(|_| path.to_string_lossy().to_string())
}

fn cli_binary_name() -> &'static str {
    #[cfg(windows)]
    {
        "markflowy.exe"
    }

    #[cfg(not(windows))]
    {
        "markflowy"
    }
}

fn path_entries() -> Vec<PathBuf> {
    env::var_os("PATH")
        .map(|paths| env::split_paths(&paths).collect())
        .unwrap_or_default()
}

#[cfg(windows)]
fn same_path(left: &std::path::Path, right: &std::path::Path) -> bool {
    left.to_string_lossy()
        .eq_ignore_ascii_case(&right.to_string_lossy())
}

#[cfg(not(windows))]
fn same_path(left: &std::path::Path, right: &std::path::Path) -> bool {
    left == right
}

fn push_unique_path(paths: &mut Vec<PathBuf>, path: PathBuf) {
    if !paths
        .iter()
        .any(|existing_path| same_path(existing_path, &path))
    {
        paths.push(path);
    }
}

fn path_contains_dir(dir: &std::path::Path) -> bool {
    path_entries()
        .iter()
        .any(|path_entry| same_path(path_entry, dir))
}

fn existing_cli_paths() -> Vec<PathBuf> {
    let cli_binary_name = cli_binary_name();

    path_entries()
        .into_iter()
        .map(|dir| dir.join(cli_binary_name))
        .filter(|path| path.exists())
        .collect()
}

#[cfg(unix)]
fn existing_cli_candidate_dirs(home_dir: &std::path::Path) -> Vec<PathBuf> {
    vec![
        home_dir.join(".local").join("bin"),
        home_dir.join("bin"),
        env::var_os("CARGO_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home_dir.join(".cargo"))
            .join("bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/opt/homebrew/bin"),
    ]
}

#[cfg(windows)]
fn existing_cli_candidate_dirs(_home_dir: &std::path::Path) -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(unix)]
fn new_cli_candidate_dirs(home_dir: &std::path::Path) -> Vec<PathBuf> {
    vec![
        home_dir.join(".local").join("bin"),
        home_dir.join("bin"),
        env::var_os("CARGO_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home_dir.join(".cargo"))
            .join("bin"),
    ]
}

#[cfg(windows)]
fn new_cli_candidate_dirs(_home_dir: &std::path::Path) -> Vec<PathBuf> {
    // On Windows, prefer updating an existing PATH entry only. Adding a new user
    // bin directory requires changing PATH, which should be an explicit install step.
    Vec::new()
}

fn cli_install_paths(app: &tauri::App) -> Vec<PathBuf> {
    let mut paths = existing_cli_paths();
    let Some(home_dir) = app.path().home_dir().ok() else {
        return paths;
    };

    for dir in existing_cli_candidate_dirs(&home_dir) {
        let path = dir.join(cli_binary_name());
        if path.exists() {
            push_unique_path(&mut paths, path);
        }
    }

    for dir in new_cli_candidate_dirs(&home_dir) {
        if path_contains_dir(&dir) {
            let path = dir.join(cli_binary_name());
            push_unique_path(&mut paths, path);
        }
    }

    paths
}

#[cfg(unix)]
fn install_cli_link(
    target_path: &std::path::Path,
    current_exe: &std::path::Path,
) -> std::io::Result<()> {
    use std::os::unix::fs::symlink;

    if target_path == current_exe {
        return Ok(());
    }

    if fs::read_link(target_path)
        .map(|linked_path| linked_path == current_exe)
        .unwrap_or(false)
    {
        return Ok(());
    }

    let _ = fs::remove_file(target_path);
    symlink(current_exe, target_path)
}

#[cfg(windows)]
fn install_cli_link(
    target_path: &std::path::Path,
    current_exe: &std::path::Path,
) -> std::io::Result<()> {
    if target_path == current_exe {
        return Ok(());
    }

    let _ = fs::remove_file(target_path);
    fs::copy(current_exe, target_path).map(|_| ())
}

fn install_cli(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    if cfg!(debug_assertions) || tauri::is_dev() {
        return Ok(());
    }

    let current_exe = env::current_exe()?;
    let target_paths = cli_install_paths(app);
    let mut last_error = None;
    let mut installed_count = 0;

    for target_path in target_paths {
        if let Some(parent) = target_path.parent() {
            if let Err(error) = fs::create_dir_all(parent) {
                last_error = Some(error);
                continue;
            }
        }

        match install_cli_link(&target_path, &current_exe) {
            Ok(_) => {
                installed_count += 1;
                #[cfg(debug_assertions)]
                eprintln!(
                    "[markflowy-cli] installed CLI: {:?} -> {:?}",
                    target_path, current_exe
                );
            }
            Err(error) => {
                last_error = Some(error);
            }
        }
    }

    if installed_count == 0 {
        if let Some(error) = last_error {
            return Err(Box::new(error));
        }
    }

    Ok(())
}

macro_rules! cli_debug {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        eprintln!("[markflowy-cli] {}", format!($($arg)*));
    };
}

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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_single_instance::init(
            |app_handle: &tauri::AppHandle, args: Vec<String>, cwd: String| {
                if args.len() > 1 {
                    match args[1].as_str() {
                        "open" => {
                            let opened_urls = args
                                .iter()
                                .skip(2)
                                .map(|p| path_to_file_url(p, Some(&cwd)))
                                .collect::<Vec<_>>()
                                .join(",");
                            if let Err(e) = crate::setup::init(app_handle.clone(), opened_urls) {
                                println!("CLI open failed: {:?}", e);
                            }
                        }
                        _ => {
                            let opened_urls = args
                                .iter()
                                .skip(1)
                                .map(|p| path_to_file_url(p, Some(&cwd)))
                                .collect::<Vec<_>>()
                                .join(",");
                            if !opened_urls.is_empty() {
                                if let Err(e) = crate::setup::init(app_handle.clone(), opened_urls)
                                {
                                    println!("File open failed: {:?}", e);
                                }
                            }
                        }
                    }
                }
            },
        ))
        .invoke_handler(tauri::generate_handler![
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
            fc::cmd::is_text_file,
            fc::cmd::move_files_to_target_folder,
            fc::cmd::path_join,
            fc::cmd::get_md_relative_path,
            fc::cmd::convert_text,
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
            bookmarks::cmd::rename_bookmark_item,
            search::cmd::search_files_async,
            extensions::cmd::extensions_init,
            process::app_exit,
            process::app_restart,
            themes::cmd::load_themes,
            themes::cmd::download_theme,
            themes::cmd::remove_theme,
            themes::cmd::load_local_themes,
            themes::cmd::import_local_theme,
            themes::cmd::remove_local_theme,
            font::cmd::font_list,
            workspace::cmd::is_git_repository,
            file_watcher::cmd::watch_file,
            file_watcher::cmd::stop_file_watcher,
            file_watcher::cmd::stop_all_file_watchers,
            app::clipboard::get_clipboard_html,
            app::clipboard::get_clipboard_text,
            fc::cmd::save_security_bookmark,
            fc::cmd::restore_security_bookmark,
        ])
        .setup(|app: &mut tauri::App| {
            cli_debug!("========================================");
            cli_debug!(
                "cfg!(debug_assertions)={}, tauri::is_dev()={}",
                cfg!(debug_assertions),
                tauri::is_dev()
            );
            cli_debug!(
                "custom-protocol: {}",
                if cfg!(feature = "custom-protocol") {
                    "ENABLED"
                } else {
                    "DISABLED"
                }
            );
            cli_debug!("binary: {:?}", std::env::current_exe().unwrap_or_default());

            if let Err(e) = install_cli(app) {
                cli_debug!("failed to install CLI: {:?}", e);
            }

            // Handle -V / --version before tauri CLI parsing,
            // since tauri_plugin_cli doesn't natively support these flags.
            let args: Vec<String> = env::args().collect();
            if args.iter().any(|a| a == "-V" || a == "--version") {
                print_version();
                std::process::exit(0);
            }

            match app.cli().matches() {
                Ok(matches) => {
                    if let Some(subcommand) = matches.subcommand {
                        match subcommand.name.as_str() {
                            "open" => {
                                if let Some(arg_data) = subcommand.matches.args.get("path") {
                                    if let Some(raw_path) = arg_data.value.as_str() {
                                        let url = path_to_file_url(raw_path, None);
                                        cli_debug!("open: {} -> {}", raw_path, url);

                                        let mut file_urls =
                                            app.state::<OpenedUrls>().inner().0.lock().unwrap();
                                        if let Ok(parsed) = url::Url::parse(&url) {
                                            *file_urls = Some(vec![parsed]);
                                        } else {
                                            cli_debug!("failed to parse URL: {}", url);
                                        }
                                    }
                                }
                            }
                            "version" => {
                                print_version();
                                std::process::exit(0);
                            }
                            _ => {}
                        }
                    } else if is_terminal_launch() && !cfg!(debug_assertions) {
                        cli_debug!("terminal launch, no subcommand -> showing help");
                        print_cli_help();
                        std::process::exit(0);
                    } else {
                        cli_debug!("GUI launch -> normal startup");
                    }
                }
                Err(e) => {
                    cli_debug!("cli matches error: {:?}", e);
                }
            }

            #[cfg(target_os = "macos")]
            {
                let app_data_dir = app
                    .path()
                    .app_data_dir()
                    .expect("failed to get app data dir");
                APP_DIR.lock().unwrap().insert(0, app_data_dir);
            }

            #[cfg(not(target_os = "macos"))]
            {
                let home_dir_path = app.path().home_dir().expect("failed to get home dir");
                APP_DIR.lock().unwrap().insert(0, home_dir_path);
            }

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
                opened_urls_to_string(urls)
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
                    let urls = if let Some(opened_urls) = &opened_urls {
                        append_opened_urls(opened_urls.inner(), &urls)
                    } else {
                        urls.clone()
                    };
                    let urls_str = opened_urls_to_string(&urls);

                    println!("Processed URLs string: {}", urls_str);

                    if let Some(window) = window_manager::get_focused_window(app) {
                        use tauri::Emitter;
                        println!("Emitting to focused window: {}", window.label());
                        update_window_opened_urls(&window, &urls_str);
                        let result = window.emit("opened-urls", urls_str.clone());
                        if let Some(opened_urls) = &opened_urls {
                            clear_opened_urls(opened_urls.inner());
                        }
                        println!("Emit result: {:?}", result);
                    } else {
                        if let Some(window) = window_manager::get_last_opened_window(app) {
                            use tauri::Emitter;
                            println!("Emitting to last opened window: {}", window.label());
                            update_window_opened_urls(&window, &urls_str);
                            let result = window.emit("opened-urls", urls_str.clone());
                            if let Some(opened_urls) = &opened_urls {
                                clear_opened_urls(opened_urls.inner());
                            }
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
