#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod app;
mod fc;
mod font;
mod menu;
mod pandoc;
mod search;
mod setup;
mod task_system;

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync;
use std::{collections::HashMap, sync::Mutex, sync::OnceLock};
use std::{env, fs};

use app::{
    bookmarks, conf, extensions, file_watcher, keybindings, opened_cache, process, themes,
    window_manager, workspace,
};
use dotenv;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager, State};
use tauri_plugin_cli::CliExt;
use tracing_subscriber;

#[cfg(windows)]
use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
#[cfg(windows)]
use windows_sys::Win32::UI::WindowsAndMessaging::{
    SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE,
};

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

static CLI_RUNTIME_WRITER: OnceLock<tokio::sync::mpsc::UnboundedSender<CliRuntimePatch>> =
    OnceLock::new();

const CLI_GUI_CHILD_ENV: &str = "MARKFLOWY_CLI_GUI_CHILD";
const LEGACY_WINDOW_STATE_FILENAME: &str = ".window-state.json";
const WINDOW_STATE_FILENAME: &str = ".window-state-v2.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CliWindowState {
    pub id: String,
    pub workspace_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CliCommandState {
    pub id: String,
    pub label: Option<String>,
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CliRuntimeState {
    pub version: String,
    pub pid: Option<u32>,
    pub windows: Vec<CliWindowState>,
    pub commands: Vec<CliCommandState>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliOpenPayload {
    path: String,
    kind: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CliCommandPayload {
    id: String,
}

enum CliRuntimePatch {
    Windows(Vec<CliWindowState>),
    Commands(Vec<CliCommandState>),
}

fn opened_urls_to_paths(urls: &[url::Url]) -> Vec<String> {
    urls.iter()
        .map(|u| {
            urlencoding::decode(u.as_str())
                .map(|decoded| decoded.into_owned())
                .unwrap_or_else(|_| u.as_str().to_string())
        })
        .collect()
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

fn opened_urls_update_script(opened_urls: &[String]) -> Result<String, serde_json::Error> {
    let script_opened_urls = window_manager::serialize_javascript_value(&opened_urls)?;
    Ok(format!(
        r#"
            (() => {{
                const incoming = {script_opened_urls};
                const current = Array.isArray(window.openedUrls)
                    ? window.openedUrls.filter((value) => typeof value === 'string' && value.length > 0)
                    : typeof window.openedUrls === 'string' && window.openedUrls
                      ? window.openedUrls.split(',').filter(Boolean)
                      : [];
                window.openedUrls = [...new Set([...current, ...incoming])];
            }})();
            "#
    ))
}

pub(crate) fn update_window_opened_urls(window: &tauri::WebviewWindow, opened_urls: &[String]) {
    if let Ok(script) = opened_urls_update_script(opened_urls) {
        let _ = window.eval(&script);
    }
}

fn migrate_window_state_file(config_dir: &Path) -> Result<bool, String> {
    let target_path = config_dir.join(WINDOW_STATE_FILENAME);
    if target_path.exists() {
        return Ok(false);
    }

    let legacy_path = config_dir.join(LEGACY_WINDOW_STATE_FILENAME);
    if !legacy_path.exists() {
        return Ok(false);
    }

    let legacy_content = fs::read(&legacy_path)
        .map_err(|error| format!("Failed to read legacy window state: {error}"))?;
    let stable_states = match serde_json::from_slice::<serde_json::Value>(&legacy_content) {
        Ok(serde_json::Value::Object(states)) => states
            .into_iter()
            .filter(|(label, _)| window_manager::should_persist_window_state(label))
            .collect::<serde_json::Map<_, _>>(),
        Ok(_) => serde_json::Map::new(),
        Err(error) => {
            tracing::warn!("Ignoring invalid legacy window state during migration: {error}");
            serde_json::Map::new()
        }
    };

    fs::create_dir_all(config_dir)
        .map_err(|error| format!("Failed to create window state directory: {error}"))?;
    let content = serde_json::to_vec_pretty(&stable_states)
        .map_err(|error| format!("Failed to serialize migrated window state: {error}"))?;
    let mut temp_file = tempfile::Builder::new()
        .prefix(".window-state-migration-")
        .tempfile_in(config_dir)
        .map_err(|error| format!("Failed to create window state migration file: {error}"))?;
    temp_file
        .write_all(&content)
        .map_err(|error| format!("Failed to write migrated window state: {error}"))?;
    temp_file
        .as_file_mut()
        .sync_all()
        .map_err(|error| format!("Failed to sync migrated window state: {error}"))?;
    temp_file
        .persist(&target_path)
        .map_err(|error| format!("Failed to persist migrated window state: {}", error.error))?;

    #[cfg(unix)]
    fs::File::open(config_dir)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| format!("Failed to sync window state directory: {error}"))?;

    Ok(true)
}

fn window_state_migration_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("window-state-migration")
        .setup(|app, _api| {
            let config_dir = app.path().app_config_dir()?;
            if let Err(error) = migrate_window_state_file(&config_dir) {
                tracing::warn!("Window-state migration was skipped: {error}");
            }
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod opened_url_tests {
    use super::{
        migrate_window_state_file, opened_urls_to_paths, opened_urls_update_script,
        LEGACY_WINDOW_STATE_FILENAME, WINDOW_STATE_FILENAME,
    };

    #[test]
    fn opened_url_paths_preserve_commas_as_one_array_entry() {
        let urls = vec![url::Url::parse("file:///tmp/notes%2C2026.md").unwrap()];

        assert_eq!(
            opened_urls_to_paths(&urls),
            vec!["file:///tmp/notes,2026.md".to_string()]
        );
    }

    #[test]
    fn opened_url_update_merges_pending_paths_instead_of_replacing_them() {
        let script = opened_urls_update_script(&["file:///tmp/B,2.md".to_string()])
            .expect("serialize update");

        assert!(script.contains("Array.isArray(window.openedUrls)"));
        assert!(script.contains("[...new Set([...current, ...incoming])]"));
        assert!(script.contains("file:///tmp/B,2.md"));
        assert!(!script.contains("__MARKFLOWY_BOOTSTRAP__ ="));
    }

    #[test]
    fn window_state_migration_keeps_only_stable_labels() {
        let directory = tempfile::tempdir().expect("tempdir");
        std::fs::write(
            directory.path().join(LEGACY_WINDOW_STATE_FILENAME),
            r#"{
              "main": {"width":1200,"height":800,"x":0,"y":0,"prev_x":0,"prev_y":0,"maximized":false,"visible":true,"decorated":true,"fullscreen":false},
              "conf": {"width":900,"height":600,"x":20,"y":20,"prev_x":20,"prev_y":20,"maximized":false,"visible":true,"decorated":true,"fullscreen":false},
              "main_550e8400-e29b-41d4-a716-446655440000": {"width":700,"height":500,"x":40,"y":40,"prev_x":40,"prev_y":40,"maximized":false,"visible":true,"decorated":true,"fullscreen":false},
              "mf-pdf-print-1": {"width":500,"height":500,"x":0,"y":0,"prev_x":0,"prev_y":0,"maximized":false,"visible":true,"decorated":true,"fullscreen":false}
            }"#,
        )
        .expect("write legacy state");

        assert!(migrate_window_state_file(directory.path()).expect("migrate state"));
        let migrated: serde_json::Value = serde_json::from_slice(
            &std::fs::read(directory.path().join(WINDOW_STATE_FILENAME))
                .expect("read migrated state"),
        )
        .expect("parse migrated state");
        let states = migrated.as_object().expect("state map");
        assert_eq!(states.len(), 2);
        assert!(states.contains_key("main"));
        assert!(states.contains_key("conf"));
        assert!(!states.keys().any(|label| label.starts_with("main_")));
        assert!(!states
            .keys()
            .any(|label| label.starts_with("mf-pdf-print-")));

        assert!(!migrate_window_state_file(directory.path()).expect("migration is idempotent"));
    }
}

fn print_version() {
    println!("markflowy {}", env!("CARGO_PKG_VERSION"));
}

fn print_cli_help() {
    println!(
        r#"MarkFlowy - AI-Powered Markdown Editor

Usage: markflowy [COMMAND] [OPTIONS]
       mf [COMMAND] [OPTIONS]

Commands:
  open <path> [--window-id <id>]       Open a file or folder
  file open <path> [--window-id <id>]  Open a file
  window list                          Print windows with workspace paths
  window focus <id>                    Focus a window
  command list                         Print registered GUI commands
  command execute <id> [--window-id <id>]
                                      Execute a GUI command
  status                               Print CLI runtime status
  help                                 Print this help message
  version                              Print version information

Options:
  -h, --help                          Print help
  -V, --version                       Print version
  --window-id, --window <id>           Target window id

Examples:
  markflowy open /path/to/file.md
  markflowy open /path/to/folder --window-id main
  markflowy file open /path/to/file.md --window-id main
  markflowy window list
  markflowy command execute app_save --window-id main
  markflowy help
  markflowy version

Note: Create a symlink or alias 'mf' -> 'markflowy' for shorter invocation."#
    );
}

#[cfg(windows)]
fn attach_parent_console() {
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

#[cfg(not(windows))]
fn attach_parent_console() {}

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

fn absolute_path_string(path: &str, cwd: Option<&str>) -> String {
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

    path.to_string_lossy().to_string()
}

fn runtime_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        env::var_os("LOCALAPPDATA")
            .map(PathBuf::from)
            .or_else(|| {
                env::var_os("USERPROFILE")
                    .map(|home| PathBuf::from(home).join("AppData").join("Local"))
            })
            .map(|dir| dir.join("MarkFlowy"))
    }

    #[cfg(not(windows))]
    {
        env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join(".markflowy"))
    }
}

fn runtime_state_path() -> Option<PathBuf> {
    runtime_dir().map(|dir| dir.join("runtime.json"))
}

#[cfg(unix)]
fn is_process_alive(pid: u32) -> bool {
    extern "C" {
        fn kill(pid: i32, sig: i32) -> i32;
    }

    if pid == 0 || pid == std::process::id() {
        return false;
    }

    unsafe { kill(pid as i32, 0) == 0 }
}

#[cfg(windows)]
fn is_process_alive(pid: u32) -> bool {
    use windows_sys::Win32::{
        Foundation::{CloseHandle, WAIT_TIMEOUT},
        System::Threading::{OpenProcess, WaitForSingleObject, PROCESS_SYNCHRONIZE},
    };

    if pid == 0 {
        return false;
    }

    if pid == std::process::id() {
        return true;
    }

    // Query the process object directly instead of spawning `tasklist.exe`.
    // Besides avoiding a console flash, the zero-timeout wait keeps this
    // startup-path check synchronous but non-blocking.
    let process_handle = unsafe { OpenProcess(PROCESS_SYNCHRONIZE, 0, pid) };
    if process_handle.is_null() {
        return false;
    }

    // SAFETY: `process_handle` is a valid owned handle from `OpenProcess`.
    // It is closed exactly once after the non-blocking wait.
    let wait_result = unsafe {
        let result = WaitForSingleObject(process_handle, 0);
        let _ = CloseHandle(process_handle);
        result
    };

    wait_result == WAIT_TIMEOUT
}

#[cfg(all(test, windows))]
mod windows_process_tests {
    use super::is_process_alive;

    #[test]
    fn rejects_the_reserved_zero_pid() {
        assert!(!is_process_alive(0));
    }

    #[test]
    fn keeps_the_current_process_runtime_state_alive() {
        assert!(is_process_alive(std::process::id()));
    }
}

fn empty_cli_runtime_state() -> CliRuntimeState {
    CliRuntimeState {
        version: env!("CARGO_PKG_VERSION").to_string(),
        ..Default::default()
    }
}

fn read_cli_runtime_state() -> CliRuntimeState {
    let state = runtime_state_path()
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|content| serde_json::from_str::<CliRuntimeState>(&content).ok())
        .unwrap_or_else(empty_cli_runtime_state);

    match state.pid {
        Some(pid) if is_process_alive(pid) => state,
        _ => empty_cli_runtime_state(),
    }
}

fn write_cli_runtime_state(state: &CliRuntimeState) -> Result<(), String> {
    let path = runtime_state_path().ok_or_else(|| "Failed to resolve runtime path".to_string())?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let content = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

fn collect_cli_runtime_windows(app: &tauri::AppHandle) -> Vec<CliWindowState> {
    let mut windows = Vec::new();

    let instances = WINDOW_INSTANCES
        .lock()
        .map(|instances| {
            instances
                .iter()
                .map(|(label, path)| (label.clone(), path.clone()))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    for (label, path) in instances {
        if app.get_webview_window(&label).is_some() {
            windows.push(CliWindowState {
                id: label,
                workspace_path: path.to_string_lossy().to_string(),
            });
        }
    }

    if app.get_webview_window("main").is_some() && !windows.iter().any(|window| window.id == "main")
    {
        windows.push(CliWindowState {
            id: "main".to_string(),
            workspace_path: "".to_string(),
        });
    }

    windows.sort_by(|a, b| a.id.cmp(&b.id));
    windows
}

fn apply_cli_runtime_patch(state: &mut CliRuntimeState, patch: CliRuntimePatch) {
    state.version = env!("CARGO_PKG_VERSION").to_string();
    state.pid = Some(std::process::id());

    match patch {
        CliRuntimePatch::Windows(windows) => state.windows = windows,
        CliRuntimePatch::Commands(mut commands) => {
            commands.sort_by(|a, b| a.id.cmp(&b.id));
            state.commands = commands;
        }
    }
}

async fn run_cli_runtime_writer(
    mut receiver: tokio::sync::mpsc::UnboundedReceiver<CliRuntimePatch>,
) {
    let mut state = match app::startup_io::run(read_cli_runtime_state).await {
        Ok(state) => state,
        Err(error) => {
            tracing::warn!("Failed to join CLI runtime state reader: {error}");
            empty_cli_runtime_state()
        }
    };

    while let Some(patch) = receiver.recv().await {
        apply_cli_runtime_patch(&mut state, patch);
        while let Ok(patch) = receiver.try_recv() {
            apply_cli_runtime_patch(&mut state, patch);
        }

        let snapshot = state.clone();
        match app::startup_io::run(move || write_cli_runtime_state(&snapshot)).await {
            Ok(Ok(())) => {}
            Ok(Err(error)) => tracing::warn!("Failed to write CLI runtime state: {error}"),
            Err(error) => tracing::warn!("Failed to join CLI runtime state writer: {error}"),
        }
    }
}

fn enqueue_cli_runtime_patch(patch: CliRuntimePatch) -> Result<(), String> {
    let writer = CLI_RUNTIME_WRITER.get_or_init(|| {
        let (sender, receiver) = tokio::sync::mpsc::unbounded_channel();
        tauri::async_runtime::spawn(run_cli_runtime_writer(receiver));
        sender
    });

    writer
        .send(patch)
        .map_err(|_| "CLI runtime state writer is unavailable".to_string())
}

fn sync_cli_runtime_windows(app: &tauri::AppHandle) -> Result<(), String> {
    enqueue_cli_runtime_patch(CliRuntimePatch::Windows(collect_cli_runtime_windows(app)))
}

#[cfg(test)]
mod cli_runtime_writer_tests {
    use super::{
        apply_cli_runtime_patch, CliCommandState, CliRuntimePatch, CliRuntimeState, CliWindowState,
    };

    #[test]
    fn runtime_patches_merge_without_dropping_other_fields() {
        let mut state = CliRuntimeState::default();

        apply_cli_runtime_patch(
            &mut state,
            CliRuntimePatch::Windows(vec![CliWindowState {
                id: "main".to_string(),
                workspace_path: "/workspace".to_string(),
            }]),
        );
        apply_cli_runtime_patch(
            &mut state,
            CliRuntimePatch::Commands(vec![
                CliCommandState {
                    id: "z-command".to_string(),
                    label: None,
                    category: None,
                },
                CliCommandState {
                    id: "a-command".to_string(),
                    label: None,
                    category: None,
                },
            ]),
        );

        assert_eq!(state.windows.len(), 1);
        assert_eq!(state.windows[0].id, "main");
        assert_eq!(state.commands[0].id, "a-command");
        assert_eq!(state.commands[1].id, "z-command");
        assert_eq!(state.pid, Some(std::process::id()));
    }
}

fn print_json<T: Serialize>(value: &T) {
    match serde_json::to_string_pretty(value) {
        Ok(content) => println!("{content}"),
        Err(error) => {
            eprintln!("Failed to serialize JSON: {error}");
            std::process::exit(1);
        }
    }
}

fn get_arg_value(args: &[String], names: &[&str]) -> Option<String> {
    args.iter().enumerate().find_map(|(index, arg)| {
        if names.iter().any(|name| arg == name) {
            args.get(index + 1).cloned()
        } else {
            names.iter().find_map(|name| {
                arg.strip_prefix(&format!("{name}="))
                    .map(|value| value.to_string())
            })
        }
    })
}

fn strip_cli_options(args: &[String]) -> Vec<String> {
    let mut result = Vec::new();
    let mut index = 0;

    while index < args.len() {
        let arg = &args[index];
        if arg == "--window-id" || arg == "--window" {
            index += 2;
            continue;
        }
        if arg.starts_with("--window-id=") || arg.starts_with("--window=") {
            index += 1;
            continue;
        }

        result.push(arg.clone());
        index += 1;
    }

    result
}

fn target_window<'a>(
    app: &'a tauri::AppHandle,
    window_id: Option<&str>,
) -> Option<tauri::WebviewWindow> {
    window_id
        .and_then(|id| app.get_webview_window(id))
        .or_else(|| window_manager::get_focused_window(app))
}

fn emit_open_to_window(
    app: &tauri::AppHandle,
    window_id: Option<&str>,
    path: String,
    kind: &str,
) -> Result<(), String> {
    let window = target_window(app, window_id).ok_or_else(|| "Window not found".to_string())?;
    window.set_focus().map_err(|e| e.to_string())?;
    window
        .emit(
            "cli:open",
            CliOpenPayload {
                path,
                kind: kind.to_string(),
            },
        )
        .map_err(|e| e.to_string())
}

fn handle_running_cli_command(app: &tauri::AppHandle, args: &[String], cwd: Option<&str>) {
    let positional = strip_cli_options(args);
    if positional.len() <= 1 {
        return;
    }

    let window_id = get_arg_value(args, &["--window-id", "--window"]);

    match positional[1].as_str() {
        "open" => {
            if let Some(path) = positional.get(2) {
                let path = absolute_path_string(path, cwd);
                if let Err(error) = emit_open_to_window(app, window_id.as_deref(), path, "auto") {
                    println!("CLI open failed: {error}");
                }
            }
        }
        "file" if positional.get(2).map(String::as_str) == Some("open") => {
            if let Some(path) = positional.get(3) {
                let path = absolute_path_string(path, cwd);
                if let Err(error) = emit_open_to_window(app, window_id.as_deref(), path, "file") {
                    println!("CLI file open failed: {error}");
                }
            }
        }
        "window" if positional.get(2).map(String::as_str) == Some("focus") => {
            if let Some(target) = positional.get(3) {
                if let Some(window) = app.get_webview_window(target) {
                    let _ = window.set_focus();
                } else {
                    println!("Window not found: {target}");
                }
            }
        }
        "command" if positional.get(2).map(String::as_str) == Some("execute") => {
            if let Some(command_id) = positional.get(3) {
                if let Some(window) = target_window(app, window_id.as_deref()) {
                    let _ = window.set_focus();
                    if let Err(error) = window.emit(
                        "cli:command",
                        CliCommandPayload {
                            id: command_id.clone(),
                        },
                    ) {
                        println!("CLI command execute failed: {error}");
                    }
                } else {
                    println!("Window not found");
                }
            }
        }
        _ => {}
    }
}

fn is_cli_control_command(positional: &[String]) -> bool {
    matches!(
        positional.get(1).map(String::as_str),
        Some("open") | Some("file") | Some("window") | Some("command")
    )
}

fn spawn_cli_gui_child_and_exit(args: &[String]) {
    if env::var_os(CLI_GUI_CHILD_ENV).is_some() || !is_cli_control_command(&strip_cli_options(args))
    {
        return;
    }

    let exe = match env::current_exe() {
        Ok(exe) => exe,
        Err(error) => {
            eprintln!("Failed to resolve MarkFlowy executable: {error}");
            std::process::exit(1);
        }
    };

    let mut command = std::process::Command::new(exe);
    command
        .args(env::args_os().skip(1))
        .env(CLI_GUI_CHILD_ENV, "1")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());

    if let Err(error) = command.spawn() {
        eprintln!("Failed to start MarkFlowy GUI process: {error}");
        std::process::exit(1);
    }

    std::process::exit(0);
}

fn handle_read_only_cli_command() {
    let args: Vec<String> = env::args().collect();
    let positional = strip_cli_options(&args);

    if args.iter().any(|a| a == "-V" || a == "--version") {
        print_version();
        std::process::exit(0);
    }
    if args
        .iter()
        .any(|a| a == "-h" || a == "--help" || a == "help")
    {
        print_cli_help();
        std::process::exit(0);
    }

    match positional.get(1).map(String::as_str) {
        Some("status") => {
            let state = read_cli_runtime_state();
            print_json(&state);
            std::process::exit(0);
        }
        Some("window") if positional.get(2).map(String::as_str) == Some("list") => {
            let state = read_cli_runtime_state();
            print_json(&state.windows);
            std::process::exit(0);
        }
        Some("command") if positional.get(2).map(String::as_str) == Some("list") => {
            let state = read_cli_runtime_state();
            print_json(&state.commands);
            std::process::exit(0);
        }
        _ => {}
    }

    spawn_cli_gui_child_and_exit(&args);
}

#[tauri::command]
fn update_cli_window_state(
    app: tauri::AppHandle,
    window_id: String,
    workspace_path: Option<String>,
) -> Result<(), String> {
    {
        let mut instances = WINDOW_INSTANCES
            .lock()
            .map_err(|_| "Failed to lock window instances".to_string())?;

        if let Some(path) = workspace_path {
            if path.is_empty() {
                instances.remove(&window_id);
            } else {
                instances.insert(window_id, PathBuf::from(path));
            }
        } else {
            instances.remove(&window_id);
        }
    }

    sync_cli_runtime_windows(&app)
}

#[tauri::command]
fn update_cli_command_state(commands: Vec<CliCommandState>) -> Result<(), String> {
    enqueue_cli_runtime_patch(CliRuntimePatch::Commands(commands))
}

/// CLI wrapper 的文件名
fn cli_wrapper_name() -> &'static str {
    #[cfg(windows)]
    {
        "markflowy.cmd"
    }

    #[cfg(not(windows))]
    {
        "markflowy"
    }
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

fn path_contains_dir(dir: &std::path::Path) -> bool {
    path_entries()
        .iter()
        .any(|path_entry| same_path(path_entry, dir))
}

fn current_exe_for_cli_wrapper() -> std::io::Result<PathBuf> {
    #[cfg(target_os = "linux")]
    {
        if let Some(appimage) = env::var_os("APPIMAGE") {
            let appimage_path = PathBuf::from(appimage);
            if appimage_path.is_absolute() && appimage_path.exists() {
                return Ok(appimage_path);
            }
        }
    }

    env::current_exe()
}

/// CLI wrapper 安装的目标目录（仅一个，不再猜测多个）
#[cfg(unix)]
fn cli_install_dir(home_dir: &std::path::Path) -> PathBuf {
    home_dir.join(".local").join("bin")
}

#[cfg(windows)]
fn cli_install_dir(home_dir: &std::path::Path) -> PathBuf {
    env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| home_dir.join("AppData").join("Local"))
        .join("MarkFlowy")
        .join("bin")
}

/// 版本标记文件路径，与 wrapper 同目录
fn cli_version_file(dir: &std::path::Path) -> PathBuf {
    dir.join(".markflowy-cli-version")
}

/// 读取已安装 CLI 的版本标记
fn read_installed_cli_version(dir: &std::path::Path) -> Option<String> {
    let version_path = cli_version_file(dir);
    fs::read_to_string(&version_path)
        .ok()
        .map(|v| v.trim().to_string())
}

/// 写入版本标记
fn write_installed_cli_version(dir: &std::path::Path, version: &str) -> std::io::Result<()> {
    fs::write(cli_version_file(dir), version)
}

/// 生成 Unix wrapper script 内容
#[cfg(unix)]
fn generate_wrapper_script(exe_path: &std::path::Path) -> String {
    let exe_str = exe_path.to_string_lossy();
    format!(
        "#!/usr/bin/env sh\n# MarkFlowy CLI wrapper - auto-generated, do not edit\nexec \"{exe_str}\" \"$@\"\n"
    )
}

/// 生成 Windows wrapper .cmd 文件内容
#[cfg(any(windows, test))]
fn generate_windows_wrapper_script(exe_path: &std::path::Path) -> String {
    let exe_str = exe_path.to_string_lossy();
    format!(
        "@echo off\r\nrem MarkFlowy CLI wrapper - auto-generated, do not edit\r\n\"{exe_str}\" %*\r\n"
    )
}

#[cfg(windows)]
fn generate_wrapper_script(exe_path: &std::path::Path) -> String {
    generate_windows_wrapper_script(exe_path)
}

/// 安装 CLI wrapper（替代原来的 symlink/copy）
fn install_cli_wrapper(
    target_path: &std::path::Path,
    current_exe: &std::path::Path,
) -> std::io::Result<()> {
    if target_path == current_exe {
        return Ok(());
    }

    // 先删除旧文件（可能是 symlink 或旧 wrapper）
    // 必须先删除，否则 fs::write 会跟随 symlink 写入到目标文件
    #[cfg(windows)]
    match fs::symlink_metadata(target_path) {
        Ok(_) => fs::remove_file(target_path)?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }

    #[cfg(not(windows))]
    let _ = fs::remove_file(target_path);

    let script = generate_wrapper_script(current_exe);
    fs::write(target_path, &script)?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(target_path, fs::Permissions::from_mode(0o755))?;
    }

    Ok(())
}

#[cfg(any(windows, test))]
fn cli_installation_is_current(
    target_dir: &std::path::Path,
    expected_version: &str,
    wrapper_name: &str,
    expected_wrapper: &str,
    shadowing_binary_name: Option<&str>,
) -> bool {
    if read_installed_cli_version(target_dir).as_deref() != Some(expected_version) {
        return false;
    }

    match fs::read_to_string(target_dir.join(wrapper_name)) {
        Ok(wrapper) if wrapper == expected_wrapper => {}
        _ => return false,
    }

    if let Some(binary_name) = shadowing_binary_name {
        match fs::symlink_metadata(target_dir.join(binary_name)) {
            Ok(_) => return false,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return false,
        }
    }

    true
}

/// 检查已安装的 wrapper 是否是最新版本
#[cfg(windows)]
fn is_cli_up_to_date(target_dir: &std::path::Path, current_exe: &std::path::Path) -> bool {
    let app_version = env!("CARGO_PKG_VERSION");
    let expected_wrapper = generate_wrapper_script(current_exe);

    cli_installation_is_current(
        target_dir,
        app_version,
        cli_wrapper_name(),
        &expected_wrapper,
        Some(cli_binary_name()),
    )
}

#[cfg(not(windows))]
fn is_cli_up_to_date(target_dir: &std::path::Path, _current_exe: &std::path::Path) -> bool {
    let app_version = env!("CARGO_PKG_VERSION");
    read_installed_cli_version(target_dir).as_deref() == Some(app_version)
}

#[cfg(test)]
mod cli_installation_tests {
    use super::{
        cli_installation_is_current, generate_windows_wrapper_script, prioritize_path_entries,
        remove_legacy_cli_binary,
    };
    use std::{
        fs,
        path::{Path, PathBuf},
    };
    use tempfile::tempdir;

    const VERSION: &str = env!("CARGO_PKG_VERSION");
    const WRAPPER_NAME: &str = "markflowy.cmd";
    const LEGACY_BINARY_NAME: &str = "markflowy.exe";

    fn write_current_windows_installation(target_dir: &Path, current_exe: &Path) -> String {
        let wrapper = generate_windows_wrapper_script(current_exe);
        fs::write(target_dir.join(".markflowy-cli-version"), VERSION).unwrap();
        fs::write(target_dir.join(WRAPPER_NAME), &wrapper).unwrap();
        wrapper
    }

    #[test]
    fn accepts_matching_windows_cli_wrapper_without_legacy_exe() {
        let target_dir = tempdir().unwrap();
        let current_exe = Path::new(r"C:\Program Files\MarkFlowy\markflowy.exe");
        let wrapper = write_current_windows_installation(target_dir.path(), current_exe);

        assert!(cli_installation_is_current(
            target_dir.path(),
            VERSION,
            WRAPPER_NAME,
            &wrapper,
            Some(LEGACY_BINARY_NAME),
        ));
    }

    #[test]
    fn rejects_matching_version_when_windows_wrapper_targets_old_gui() {
        let target_dir = tempdir().unwrap();
        let current_exe = Path::new(r"C:\Program Files\MarkFlowy\markflowy.exe");
        let expected_wrapper = generate_windows_wrapper_script(current_exe);
        let old_wrapper =
            generate_windows_wrapper_script(Path::new(r"C:\OldMarkFlowy\markflowy.exe"));
        fs::write(target_dir.path().join(".markflowy-cli-version"), VERSION).unwrap();
        fs::write(target_dir.path().join(WRAPPER_NAME), old_wrapper).unwrap();

        assert!(!cli_installation_is_current(
            target_dir.path(),
            VERSION,
            WRAPPER_NAME,
            &expected_wrapper,
            Some(LEGACY_BINARY_NAME),
        ));
    }

    #[test]
    fn rejects_windows_wrapper_shadowed_by_legacy_exe() {
        let target_dir = tempdir().unwrap();
        let current_exe = Path::new(r"C:\Program Files\MarkFlowy\markflowy.exe");
        let wrapper = write_current_windows_installation(target_dir.path(), current_exe);
        fs::write(target_dir.path().join(LEGACY_BINARY_NAME), b"legacy").unwrap();

        assert!(!cli_installation_is_current(
            target_dir.path(),
            VERSION,
            WRAPPER_NAME,
            &wrapper,
            Some(LEGACY_BINARY_NAME),
        ));
    }

    #[test]
    fn rejects_missing_or_corrupt_windows_cli_state() {
        let target_dir = tempdir().unwrap();
        let current_exe = Path::new(r"C:\Program Files\MarkFlowy\markflowy.exe");
        let expected_wrapper = generate_windows_wrapper_script(current_exe);

        assert!(!cli_installation_is_current(
            target_dir.path(),
            VERSION,
            WRAPPER_NAME,
            &expected_wrapper,
            Some(LEGACY_BINARY_NAME),
        ));

        fs::write(target_dir.path().join(".markflowy-cli-version"), VERSION).unwrap();
        fs::write(target_dir.path().join(WRAPPER_NAME), "corrupt").unwrap();

        assert!(!cli_installation_is_current(
            target_dir.path(),
            VERSION,
            WRAPPER_NAME,
            &expected_wrapper,
            Some(LEGACY_BINARY_NAME),
        ));
    }

    #[test]
    fn removes_managed_legacy_cli_binary() {
        let target_dir = tempdir().unwrap();
        let legacy_exe = target_dir.path().join(LEGACY_BINARY_NAME);
        fs::write(&legacy_exe, b"legacy").unwrap();

        assert!(remove_legacy_cli_binary(&legacy_exe, Path::new("/installed/markflowy")).unwrap());
        assert!(!legacy_exe.exists());
    }

    #[test]
    fn refuses_to_repair_from_the_running_legacy_copy() {
        let target_dir = tempdir().unwrap();
        let legacy_exe = target_dir.path().join(LEGACY_BINARY_NAME);
        fs::write(&legacy_exe, b"legacy").unwrap();

        assert!(remove_legacy_cli_binary(&legacy_exe, &legacy_exe).is_err());
        assert!(legacy_exe.exists());
    }

    #[test]
    fn prioritizes_and_deduplicates_the_managed_cli_path() {
        let managed_dir = Path::new("/managed/bin");
        let entries = vec![
            PathBuf::from("/old/bin"),
            managed_dir.to_path_buf(),
            PathBuf::from("/other/bin"),
            managed_dir.to_path_buf(),
        ];

        let reordered =
            prioritize_path_entries(entries, managed_dir, |entry| entry == managed_dir).unwrap();

        assert_eq!(
            reordered,
            vec![
                managed_dir.to_path_buf(),
                PathBuf::from("/old/bin"),
                PathBuf::from("/other/bin"),
            ]
        );
    }

    #[test]
    fn leaves_an_already_preferred_cli_path_unchanged() {
        let managed_dir = Path::new("/managed/bin");
        let entries = vec![managed_dir.to_path_buf(), PathBuf::from("/other/bin")];

        assert!(
            prioritize_path_entries(entries, managed_dir, |entry| { entry == managed_dir })
                .is_none()
        );
    }
}

macro_rules! cli_debug {
    ($($arg:tt)*) => {
        #[cfg(debug_assertions)]
        eprintln!("[markflowy-cli] {}", format!($($arg)*));
    };
}

/// 清理旧版本安装的 symlink/copy（旧代码会在多个目录创建）
#[cfg(unix)]
fn cleanup_old_cli_symlinks(home_dir: &std::path::Path, current_exe: &std::path::Path) {
    let old_dirs: Vec<PathBuf> = vec![
        home_dir.join(".local").join("bin"),
        home_dir.join("bin"),
        env::var_os("CARGO_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|| home_dir.join(".cargo"))
            .join("bin"),
    ];

    let binary_name = cli_binary_name();
    for dir in old_dirs {
        let path = dir.join(binary_name);
        // 只删除指向当前应用二进制的 symlink，不删除用户自己创建的
        if path.is_symlink() {
            if let Ok(target) = fs::read_link(&path) {
                if target == current_exe
                    || target.is_absolute() && target.exists() && same_path(&target, current_exe)
                {
                    let _ = fs::remove_file(&path);
                    cli_debug!("cleaned up old symlink: {:?}", path);
                }
            }
        }
    }
}

/// Windows 上清理旧版本 copy 的二进制文件
#[cfg(any(windows, test))]
fn remove_legacy_cli_binary(
    old_exe: &std::path::Path,
    current_exe: &std::path::Path,
) -> std::io::Result<bool> {
    match fs::symlink_metadata(old_exe) {
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(error) => return Err(error),
    }

    // When the legacy copy launches itself, Windows keeps the executable locked.
    // Refuse to generate a wrapper that points back to that stale copy and leave
    // the version marker untouched so the installed GUI can retry the repair.
    if same_path(old_exe, current_exe) {
        return Err(std::io::Error::other(
            "cannot repair CLI while running from the legacy markflowy.exe copy",
        ));
    }

    fs::remove_file(old_exe)?;
    Ok(true)
}

#[cfg(windows)]
fn cleanup_old_cli_symlinks(
    home_dir: &std::path::Path,
    current_exe: &std::path::Path,
) -> std::io::Result<()> {
    let old_exe = cli_install_dir(home_dir).join(cli_binary_name());
    if remove_legacy_cli_binary(&old_exe, current_exe)? {
        cli_debug!("cleaned up old CLI copy: {:?}", old_exe);
    }

    Ok(())
}

#[cfg(windows)]
fn normalize_path_for_env(path: &std::path::Path) -> String {
    path.to_string_lossy().trim_end_matches('\\').to_string()
}

#[cfg(any(windows, test))]
fn prioritize_path_entries<F>(
    entries: Vec<PathBuf>,
    dir: &std::path::Path,
    matches_dir: F,
) -> Option<Vec<PathBuf>>
where
    F: Fn(&std::path::Path) -> bool,
{
    let already_preferred = entries.first().is_some_and(|entry| matches_dir(entry))
        && entries.iter().filter(|entry| matches_dir(entry)).count() == 1;
    if already_preferred {
        return None;
    }

    Some(
        std::iter::once(dir.to_path_buf())
            .chain(
                entries
                    .into_iter()
                    .filter(|entry| !matches_dir(entry.as_path())),
            )
            .collect(),
    )
}

#[cfg(windows)]
fn prioritize_user_path_dir(
    user_path: &str,
    dir: &std::path::Path,
) -> Result<Option<String>, env::JoinPathsError> {
    let entries: Vec<PathBuf> = if user_path.is_empty() {
        Vec::new()
    } else {
        env::split_paths(user_path).collect()
    };
    let matches_dir = |entry: &std::path::Path| {
        normalize_path_for_env(entry).eq_ignore_ascii_case(&normalize_path_for_env(dir))
    };

    let Some(reordered) = prioritize_path_entries(entries, dir, matches_dir) else {
        return Ok(None);
    };
    let new_path = env::join_paths(reordered)?;

    Ok(Some(new_path.to_string_lossy().into_owned()))
}

#[cfg(windows)]
fn broadcast_environment_change() {
    let environment: Vec<u16> = "Environment\0".encode_utf16().collect();

    unsafe {
        SendMessageTimeoutW(
            HWND_BROADCAST,
            WM_SETTINGCHANGE,
            0,
            environment.as_ptr() as isize,
            SMTO_ABORTIFHUNG,
            5000,
            std::ptr::null_mut(),
        );
    }
}

#[cfg(windows)]
fn ensure_user_path_contains_dir(dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ, KEY_WRITE, REG_EXPAND_SZ, REG_SZ};
    use winreg::types::{FromRegValue, ToRegValue};
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let environment = hkcu.open_subkey_with_flags("Environment", KEY_READ | KEY_WRITE)?;
    let current_value = match environment.get_raw_value("Path") {
        Ok(value) => Some(value),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(Box::new(error)),
    };
    if let Some(current_value) = &current_value {
        if current_value.vtype != REG_SZ && current_value.vtype != REG_EXPAND_SZ {
            return Err(Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "user Path registry value must be REG_SZ or REG_EXPAND_SZ",
            )));
        }
    }

    let current_path = current_value
        .as_ref()
        .map(String::from_reg_value)
        .transpose()?
        .unwrap_or_default();

    let Some(new_path) = prioritize_user_path_dir(&current_path, dir)? else {
        return Ok(());
    };

    let mut new_value = new_path.to_reg_value();
    if let Some(current_value) = current_value {
        new_value.vtype = current_value.vtype;
    }

    environment.set_raw_value("Path", &new_value)?;
    broadcast_environment_change();

    Ok(())
}

#[cfg(not(windows))]
fn ensure_user_path_contains_dir(_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    Ok(())
}

fn install_cli_in_background(app: &tauri::App) {
    if cfg!(debug_assertions) || tauri::is_dev() {
        return;
    }

    let Some(home_dir) = app.path().home_dir().ok() else {
        return;
    };

    tauri::async_runtime::spawn_blocking(move || {
        let install_dir = cli_install_dir(&home_dir);

        // Unix 上目标目录需要在 PATH 中才安装。PATH 扫描放在后台，避免拖慢首屏窗口创建。
        #[cfg(unix)]
        if !path_contains_dir(&install_dir) {
            cli_debug!("install dir {:?} not in PATH, skipping", install_dir);
            return;
        }

        let current_exe = match current_exe_for_cli_wrapper() {
            Ok(path) => path,
            Err(error) => {
                cli_debug!("failed to get current exe for CLI install: {:?}", error);
                return;
            }
        };

        #[cfg(windows)]
        {
            if let Err(error) = fs::create_dir_all(&install_dir) {
                cli_debug!("failed to create install dir: {:?}", error);
                return;
            }

            // Always retry the managed legacy-exe cleanup before trusting the
            // version marker. An earlier update may have failed because the old
            // executable was still running and locked by Windows.
            if let Err(error) = cleanup_old_cli_symlinks(&home_dir, &current_exe) {
                cli_debug!("failed to clean up old CLI copy: {:?}", error);
                return;
            }

            // Keep the managed CLI directory first in the user PATH. This makes
            // the maintained wrapper win over copies left in older PATH entries
            // without deleting files outside MarkFlowy's managed directory.
            if let Err(error) = ensure_user_path_contains_dir(&install_dir) {
                cli_debug!("failed to prioritize CLI dir in PATH: {:?}", error);
            }
        }

        // 版本和路径都匹配，无需更新。版本标记读取也在后台执行。
        if is_cli_up_to_date(&install_dir, &current_exe) {
            cli_debug!("CLI wrapper is up to date, skipping install");
            return;
        }

        let app_version = env!("CARGO_PKG_VERSION").to_string();

        #[cfg(unix)]
        cleanup_old_cli_symlinks(&home_dir, &current_exe);

        #[cfg(unix)]
        if let Err(error) = fs::create_dir_all(&install_dir) {
            cli_debug!("failed to create install dir: {:?}", error);
            return;
        }

        let target_path = install_dir.join(cli_wrapper_name());

        match install_cli_wrapper(&target_path, &current_exe) {
            Ok(_) => {
                #[cfg(windows)]
                {
                    let expected_wrapper = generate_wrapper_script(&current_exe);
                    match fs::read_to_string(&target_path) {
                        Ok(wrapper) if wrapper == expected_wrapper => {}
                        Ok(_) => {
                            cli_debug!("installed CLI wrapper verification failed");
                            return;
                        }
                        Err(error) => {
                            cli_debug!("failed to verify installed CLI wrapper: {:?}", error);
                            return;
                        }
                    }
                }

                // The marker is the final success record for the managed files
                // on Windows. Cleanup, wrapper installation, and verification
                // must succeed first so a partial update is retried next launch.
                if let Err(error) = write_installed_cli_version(&install_dir, &app_version) {
                    cli_debug!("failed to write CLI version file: {:?}", error);
                    return;
                }

                #[cfg(not(windows))]
                if let Err(error) = ensure_user_path_contains_dir(&install_dir) {
                    cli_debug!("failed to add CLI dir to PATH: {:?}", error);
                }

                cli_debug!(
                    "installed CLI wrapper: {:?} -> {:?}",
                    target_path,
                    current_exe
                );
            }
            Err(error) => {
                cli_debug!("failed to install CLI wrapper: {:?}", error);
            }
        }
    });
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
    attach_parent_console();
    handle_read_only_cli_command();

    let context = tauri::generate_context!();

    let app = tauri::Builder::default()
        .manage(OpenedUrls(Default::default()))
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(window_state_migration_plugin())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Dynamic workspace and print-window labels are never reused, so
                // persisting them only grows the startup state file indefinitely.
                .with_filename(WINDOW_STATE_FILENAME)
                .with_filter(window_manager::should_persist_window_state)
                // Windows renders a custom frameless title bar. Restoring the
                // saved `decorated` flag from a previous run re-enables the
                // native title bar, stacking a second title bar on top of the
                // custom one.
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        & !tauri_plugin_window_state::StateFlags::DECORATIONS,
                )
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_single_instance::init(
            |app_handle: &tauri::AppHandle, args: Vec<String>, cwd: String| {
                handle_running_cli_command(app_handle, &args, Some(&cwd));
                let positional = strip_cli_options(&args);
                if matches!(
                    positional.get(1).map(String::as_str),
                    Some("open") | Some("file") | Some("window") | Some("command")
                ) {
                    return;
                }
                if args.len() > 1 {
                    match args[1].as_str() {
                        "open" => {
                            if get_arg_value(&args, &["--window-id", "--window"]).is_some() {
                                return;
                            }
                            let opened_urls = args
                                .iter()
                                .skip(2)
                                .filter(|arg| !arg.starts_with("--window"))
                                .map(|p| path_to_file_url(p, Some(&cwd)))
                                .collect::<Vec<_>>();
                            if let Err(e) = crate::setup::init(app_handle.clone(), opened_urls) {
                                println!("CLI open failed: {:?}", e);
                            }
                        }
                        _ => {
                            let opened_urls = args
                                .iter()
                                .skip(1)
                                .map(|p| path_to_file_url(p, Some(&cwd)))
                                .collect::<Vec<_>>();
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
            fc::cmd::get_file_write_revision,
            fc::cmd::conditional_write_file,
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
            fc::cmd::paths_refer_to_same_file,
            fc::cmd::paths_refer_to_same_directory_entry,
            fc::cmd::trash_delete,
            fc::cmd::export_html_to_path,
            pandoc::probe_pandoc,
            pandoc::export_markdown_with_pandoc,
            fc::cmd::is_dir,
            fc::cmd::get_path_name,
            fc::cmd::get_file_normal_info,
            fc::cmd::copy_file,
            conf::cmd::get_app_conf,
            conf::cmd::reset_app_conf,
            conf::cmd::save_app_conf,
            conf::cmd::save_startup_appearance,
            conf::cmd::get_system_theme,
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
            themes::cmd::load_theme_catalog,
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
            fc::cmd::release_security_scopes,
            fc::cmd::activate_workspace_root,
            update_cli_window_state,
            update_cli_command_state,
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

            install_cli_in_background(app);

            // Handle -V / --version before tauri CLI parsing,
            // since tauri_plugin_cli doesn't natively support these flags.
            let args: Vec<String> = env::args().collect();
            if args.iter().any(|a| a == "-V" || a == "--version") {
                print_version();
                std::process::exit(0);
            }
            if args.iter().any(|a| a == "-h" || a == "--help" || a == "help") {
                print_cli_help();
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
                            "file" => {
                                let args: Vec<String> = env::args().collect();
                                let positional = strip_cli_options(&args);
                                if positional.get(2).map(String::as_str) == Some("open") {
                                    if let Some(raw_path) = positional.get(3) {
                                        let url = path_to_file_url(raw_path, None);
                                        cli_debug!("file open: {} -> {}", raw_path, url);

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
                opened_urls_to_paths(urls)
            } else {
                Vec::new()
            };

            setup::init(app.handle().clone(), opened_urls).map_err(|error| {
                eprintln!("Failed to create MarkFlowy window: {error}");
                eprintln!(
                    "If this happens on Linux, check WebKitGTK/GTK runtime dependencies and try launching with GDK_BACKEND=x11 markflowy."
                );
                error
            })?;
            let _ = sync_cli_runtime_windows(app.handle());

            #[cfg(target_os = "macos")]
            menu::generate_menu(app).expect("failed to generate menu");

            Ok(())
        })
        .on_window_event(|window, event| {
            let app = window.app_handle();

            match event {
                tauri::WindowEvent::Focused(true) => {
                    window_manager::mark_window_recent(window.label());
                }
                tauri::WindowEvent::Destroyed => {
                    let window_label = window.label();
                    window_manager::forget_window_recency(window_label);
                    if let Ok(mut instances) = WINDOW_INSTANCES.lock() {
                        instances.remove(window_label);
                        println!(
                            "Removed window '{}' from WINDOW_INSTANCES on close",
                            window_label
                        );
                    }
                    let _ = sync_cli_runtime_windows(app);
                }
                _ => {}
            }
        })
        .build(context);

    let app = match app {
        Ok(app) => app,
        Err(error) => {
            eprintln!("Failed to initialize MarkFlowy: {error}");
            #[cfg(target_os = "linux")]
            eprintln!(
                "Linux hint: verify WebKitGTK/GTK runtime dependencies and try GDK_BACKEND=x11 markflowy if you are on Wayland."
            );
            std::process::exit(1);
        }
    };

    app.run(|app, event| {
        #[cfg(target_os = "macos")]
        match event {
            tauri::RunEvent::Opened { urls, .. } => {
                let opened_urls = app.try_state::<OpenedUrls>();
                let urls = if let Some(opened_urls) = &opened_urls {
                    append_opened_urls(opened_urls.inner(), &urls)
                } else {
                    urls.clone()
                };
                let opened_url_paths = opened_urls_to_paths(&urls);

                println!("Processed {} opened URL(s)", opened_url_paths.len());

                if let Some(window) = window_manager::get_focused_window(app) {
                    use tauri::Emitter;
                    println!("Emitting to focused window: {}", window.label());
                    update_window_opened_urls(&window, &opened_url_paths);
                    let result = window.emit("opened-urls", opened_url_paths.clone());
                    if let Some(opened_urls) = &opened_urls {
                        clear_opened_urls(opened_urls.inner());
                    }
                    println!("Emit result: {:?}", result);
                } else {
                    if let Some(window) = window_manager::get_last_opened_window(app) {
                        use tauri::Emitter;
                        println!("Emitting to last opened window: {}", window.label());
                        update_window_opened_urls(&window, &opened_url_paths);
                        let result = window.emit("opened-urls", opened_url_paths.clone());
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
