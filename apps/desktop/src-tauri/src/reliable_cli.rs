//! Request-scoped CLI receipts. Single-instance delivery is not completion.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};

const INTERNAL_ARG: &str = "--cli-request";
const PROTOCOL_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub protocol_version: u32,
    pub request_id: String,
    pub operation: String,
    pub allow_directory: bool,
    pub path: Option<String>,
    pub window_id: Option<String>,
    pub command_id: Option<String>,
    pub preview: bool,
    pub wait_for: String,
    pub expected_sha256: Option<String>,
    pub output: Option<String>,
    pub format: Option<String>,
    pub overwrite: bool,
    pub deadline: u64,
    #[serde(default)]
    pub session_id: Option<String>,
    #[serde(default)]
    pub operation_id: Option<String>,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Receipt {
    pub protocol_version: u32,
    pub request_id: String,
    pub ok: bool,
    pub code: String,
    pub message: String,
    pub result: Value,
}

impl Receipt {
    fn error(id: &str, code: &str, message: impl ToString) -> Self {
        Self {
            protocol_version: PROTOCOL_VERSION,
            request_id: id.into(),
            ok: false,
            code: code.into(),
            message: message.to_string(),
            result: Value::Null,
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn request_root() -> Result<PathBuf, String> {
    super::runtime_dir()
        .map(|dir| dir.join("requests"))
        .ok_or("Runtime directory unavailable".into())
}

fn request_dir(id: &str) -> Result<PathBuf, String> {
    if !id.starts_with("cli-")
        || id.len() > 80
        || !id.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-')
    {
        return Err("Invalid request id".into());
    }
    Ok(request_root()?.join(id))
}

fn atomic_json(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let mut temp = tempfile::NamedTempFile::new_in(path.parent().ok_or("Missing parent")?)
        .map_err(|error| error.to_string())?;
    serde_json::to_writer(&mut temp, value).map_err(|error| error.to_string())?;
    temp.as_file()
        .sync_all()
        .map_err(|error| error.to_string())?;
    temp.persist_noclobber(path)
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

#[tauri::command]
pub async fn cli_hash_content(content: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || digest(content.as_bytes()))
        .await
        .map_err(|error| error.to_string())
}

fn absolute(path: &str, cwd: &Path) -> PathBuf {
    let path = PathBuf::from(path);
    if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    }
}

fn parse(args: &[String], cwd: &Path) -> Result<Request, String> {
    let mut positional = Vec::new();
    let mut options = HashMap::new();
    let mut flags = HashSet::new();
    let mut index = 0;
    let mut literal = false;
    while index < args.len() {
        let arg = &args[index];
        index += 1;
        if !literal && arg == "--" {
            literal = true;
            continue;
        }
        if literal || !arg.starts_with('-') {
            positional.push(arg.as_str());
            continue;
        }
        if matches!(arg.as_str(), "--preview" | "--overwrite" | "--json") {
            if !flags.insert(arg.as_str()) {
                return Err(format!("Duplicate option: {arg}"));
            }
            continue;
        }
        let (name, inline) = arg
            .split_once('=')
            .map_or((arg.as_str(), None), |(k, v)| (k, Some(v)));
        let name = if name == "--window" {
            "--window-id"
        } else {
            name
        };
        if !matches!(
            name,
            "--window-id"
                | "--timeout"
                | "--wait"
                | "--sha256"
                | "--output"
                | "--format"
                | "--request-id"
                | "--message"
                | "--offset"
        ) {
            return Err(format!("Unknown option: {name}"));
        }
        let value = if let Some(value) = inline {
            value
        } else {
            let value = args
                .get(index)
                .ok_or_else(|| format!("Missing value for {name}"))?;
            index += 1;
            if value.starts_with("--") {
                return Err(format!("Missing value for {name}"));
            }
            value
        };
        if value.is_empty() || options.insert(name, value).is_some() {
            return Err(format!("Invalid or duplicate option: {name}"));
        }
    }
    let (operation, target) = match positional.as_slice() {
        ["open", path] => ("open", *path),
        ["file", action @ ("open" | "status" | "wait" | "export" | "save"), path] => (*action, *path),
        ["history", "begin", path] => ("historyBegin", *path),
        ["history", "commit", session] => ("historyCommit", *session),
        ["history", "status", session] => ("historyStatus", *session),
        ["history", "list", path] => ("historyList", *path),
        ["command", "execute", id] => ("command", *id),
        ["window", "focus", id] => ("focus", *id),
        _ => return Err("Expected open <path>, file <open|status|wait|export> <path>, command execute <id>, or window focus <id>".into()),
    };
    let timeout = options
        .get("--timeout")
        .unwrap_or(&"30000")
        .parse::<u64>()
        .map_err(|_| "Invalid timeout")?;
    if !(1..=300_000).contains(&timeout) {
        return Err("Timeout must be 1..300000 milliseconds".into());
    }
    let wait_for = *options.get("--wait").unwrap_or(&"applied");
    if !matches!(wait_for, "applied" | "visible") {
        return Err("--wait must be applied or visible".into());
    }
    let expected = options
        .get("--sha256")
        .map(|value| value.to_ascii_lowercase());
    if expected
        .as_ref()
        .is_some_and(|value| value.len() != 64 || !value.bytes().all(|c| c.is_ascii_hexdigit()))
    {
        return Err("--sha256 must be a 64-digit SHA-256".into());
    }
    if operation != "export"
        && (options.contains_key("--output")
            || options.contains_key("--format")
            || flags.contains("--overwrite"))
    {
        return Err("Export options require file export".into());
    }
    if flags.contains("--preview") && operation != "open" {
        return Err("--preview requires file open".into());
    }
    let is_file = !matches!(
        operation,
        "command" | "focus" | "historyCommit" | "historyStatus"
    );
    if matches!(operation, "save" | "historyCommit") && expected.is_none() {
        return Err("This command requires --sha256".into());
    }
    if matches!(operation, "save" | "historyBegin") && !options.contains_key("--request-id") {
        return Err("This command requires --request-id".into());
    }
    if options.contains_key("--request-id") && !matches!(operation, "save" | "historyBegin") {
        return Err("--request-id requires file save or history begin".into());
    }
    if options.get("--request-id").is_some_and(|id| id.len() > 200) {
        return Err("--request-id must be at most 200 bytes".into());
    }
    if options.contains_key("--message") && operation != "historyCommit" {
        return Err("--message requires history commit".into());
    }
    if options
        .get("--message")
        .is_some_and(|message| message.len() > 2000)
    {
        return Err("--message must be at most 2000 bytes".into());
    }
    if options.contains_key("--offset") && operation != "historyList" {
        return Err("--offset requires history list".into());
    }
    let offset = options
        .get("--offset")
        .unwrap_or(&"0")
        .parse::<u32>()
        .map_err(|_| "Invalid history offset")?;
    if !is_file
        && operation != "historyCommit"
        && (expected.is_some() || options.contains_key("--wait"))
    {
        return Err("Content options require a file command".into());
    }
    let path = is_file.then(|| absolute(target, cwd).to_string_lossy().into_owned());
    let output = options
        .get("--output")
        .map(|path| absolute(path, cwd).to_string_lossy().into_owned());
    let format = options.get("--format").map(|s| s.to_string());
    if operation == "export" {
        if output.is_none() {
            return Err("file export requires --output <path>".into());
        }
        if !matches!(
            format.as_deref(),
            Some("html" | "markdown" | "text" | "json" | "jpg")
        ) {
            return Err("--format must be html, markdown, text, json, or jpg; PDF uses an interactive print dialog".into());
        }
    }
    Ok(Request {
        protocol_version: PROTOCOL_VERSION,
        request_id: String::new(),
        operation: operation.into(),
        allow_directory: matches!(positional.as_slice(), ["open", _]),
        path,
        window_id: if operation == "focus" {
            Some(target.into())
        } else {
            options.get("--window-id").map(|s| s.to_string())
        },
        command_id: (operation == "command").then(|| target.into()),
        preview: flags.contains("--preview"),
        wait_for: wait_for.into(),
        expected_sha256: expected,
        output,
        format,
        overwrite: flags.contains("--overwrite"),
        deadline: now_ms() + timeout,
        session_id: matches!(operation, "historyCommit" | "historyStatus").then(|| target.into()),
        operation_id: options.get("--request-id").map(|s| s.to_string()),
        message: options.get("--message").map(|s| s.to_string()),
        offset,
    })
}

fn prepare(request: &mut Request) -> Result<(), Receipt> {
    if let Some(path) = &request.path {
        if matches!(request.operation.as_str(), "historyBegin" | "historyList")
            && !Path::new(path).exists()
        {
            let parent = Path::new(path)
                .parent()
                .and_then(|p| fs::canonicalize(p).ok())
                .ok_or_else(|| {
                    Receipt::error(
                        &request.request_id,
                        "file_unavailable",
                        "Parent directory unavailable",
                    )
                })?;
            request.path = Some(
                parent
                    .join(Path::new(path).file_name().ok_or_else(|| {
                        Receipt::error(&request.request_id, "invalid_arguments", "Missing filename")
                    })?)
                    .to_string_lossy()
                    .into_owned(),
            );
            return Ok(());
        }
        let path = fs::canonicalize(path)
            .map_err(|error| Receipt::error(&request.request_id, "file_unavailable", error))?;
        if path.is_dir() {
            if !request.allow_directory || request.preview {
                return Err(Receipt::error(
                    &request.request_id,
                    "unsupported_file",
                    "Expected a text file",
                ));
            }
            request.operation = "workspace".into();
        } else if !path.is_file() {
            return Err(Receipt::error(
                &request.request_id,
                "unsupported_file",
                "Expected a regular file",
            ));
        } else if request.expected_sha256.is_none() && request.operation != "historyList" {
            // Match the editor's decoding (including BOM/UTF-16), not raw disk bytes.
            match super::fc::read_file_snapshot(&path) {
                super::fc::FileSnapshotResult::Success { content, .. } => {
                    request.expected_sha256 = Some(digest(content.as_bytes()))
                }
                super::fc::FileSnapshotResult::Unavailable { result } => {
                    return Err(Receipt::error(
                        &request.request_id,
                        "file_unavailable",
                        result.content,
                    ))
                }
                super::fc::FileSnapshotResult::Unstable => {
                    return Err(Receipt::error(
                        &request.request_id,
                        "file_unstable",
                        "File changed while reading",
                    ))
                }
            }
        }
        let path = path.to_string_lossy().into_owned();
        #[cfg(windows)]
        let path = path
            .strip_prefix(r"\\?\UNC\")
            .map(|rest| format!(r"\\{rest}"))
            .or_else(|| path.strip_prefix(r"\\?\").map(String::from))
            .unwrap_or(path);
        request.path = Some(path);
    }
    Ok(())
}

/// Runs before Tauri initialization, leaving stdout owned by the waiting client.
pub fn run_client_if_requested() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().is_some_and(|arg| arg == INTERNAL_ARG) {
        return;
    }
    let discovery_length = match args.first().map(String::as_str) {
        Some("status") => Some(1),
        Some("command" | "window") if args.get(1).map(String::as_str) == Some("list") => Some(2),
        _ => None,
    };
    if let Some(length) = discovery_length {
        if args.len() == length || (args.len() == length + 1 && args[length] == "--json") {
            return;
        }
        super::print_json(&Receipt::error(
            "",
            "invalid_arguments",
            "Unexpected discovery arguments",
        ));
        std::process::exit(2);
    }
    if !matches!(
        args.first().map(String::as_str),
        Some("open" | "file" | "command" | "window" | "history")
    ) {
        return;
    }
    if args
        .iter()
        .take_while(|arg| arg.as_str() != "--")
        .any(|arg| matches!(arg.as_str(), "--help" | "-h"))
    {
        return;
    }
    let result = (|| -> Result<Receipt, Receipt> {
        let mut request = parse(&args, &std::env::current_dir().unwrap_or_default())
            .map_err(|error| Receipt::error("", "invalid_arguments", error))?;
        let root = request_root().map_err(|error| Receipt::error("", "io_error", error))?;
        fs::create_dir_all(&root).map_err(|error| Receipt::error("", "io_error", error))?;
        let mut directory_builder = tempfile::Builder::new();
        directory_builder.prefix("cli-");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            directory_builder.permissions(fs::Permissions::from_mode(0o700));
        }
        let directory = directory_builder
            .tempdir_in(root)
            .map_err(|error| Receipt::error("", "io_error", error))?;
        request.request_id = directory
            .path()
            .file_name()
            .unwrap()
            .to_string_lossy()
            .into_owned();
        prepare(&mut request)?;
        let state = super::read_cli_runtime_state();
        if state.pid.is_none() && !matches!(request.operation.as_str(), "open" | "workspace") {
            return Err(Receipt::error(
                &request.request_id,
                "app_not_running",
                "Open MarkFlowy first",
            ));
        }
        atomic_json(&directory.path().join("request.json"), &request)
            .map_err(|error| Receipt::error(&request.request_id, "io_error", error))?;
        let exe = std::env::current_exe()
            .map_err(|error| Receipt::error(&request.request_id, "launch_failed", error))?;
        let mut child = std::process::Command::new(exe)
            .args([INTERNAL_ARG, &request.request_id])
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|error| Receipt::error(&request.request_id, "launch_failed", error))?;
        loop {
            if let Ok(bytes) = fs::read(directory.path().join("receipt.json")) {
                let receipt: Receipt = serde_json::from_slice(&bytes).map_err(|error| {
                    Receipt::error(&request.request_id, "invalid_receipt", error)
                })?;
                if receipt.request_id != request.request_id
                    || receipt.protocol_version != PROTOCOL_VERSION
                {
                    return Err(Receipt::error(
                        &request.request_id,
                        "invalid_receipt",
                        "Receipt identity mismatch",
                    ));
                }
                return Ok(receipt);
            }
            if now_ms() >= request.deadline {
                return Err(Receipt::error(
                    &request.request_id,
                    "timeout",
                    "Completion was not confirmed; inspect file/output state before retrying",
                ));
            }
            if let Ok(Some(status)) = child.try_wait() {
                if !status.success() {
                    return Err(Receipt::error(&request.request_id, "launch_failed", status));
                }
            }
            std::thread::sleep(Duration::from_millis(20));
        }
    })();
    let receipt = result.unwrap_or_else(|error| error);
    super::print_json(&receipt);
    std::process::exit(if receipt.ok {
        0
    } else if receipt.code == "invalid_arguments" {
        2
    } else {
        1
    });
}

#[derive(Clone)]
struct Pending {
    request: Request,
    window_id: String,
}
#[derive(Default)]
struct Bridge {
    ready: HashMap<String, String>,
    pending: HashMap<String, Pending>,
}
impl Bridge {
    fn set_ready(&mut self, window: &str, listener: &str, ready: bool) {
        if ready {
            self.ready.insert(window.into(), listener.into());
        } else if self.ready.get(window).map(String::as_str) == Some(listener) {
            self.ready.remove(window);
        }
    }
}
static BRIDGE: OnceLock<Mutex<Bridge>> = OnceLock::new();
fn bridge() -> &'static Mutex<Bridge> {
    BRIDGE.get_or_init(Default::default)
}

#[tauri::command]
pub fn cli_ready(window: tauri::WebviewWindow, ready: bool, listener_id: String) {
    if let Ok(mut bridge) = bridge().lock() {
        bridge.set_ready(window.label(), &listener_id, ready);
    }
}

pub fn window_destroyed(window_id: &str) {
    let mut bridge = bridge().lock().unwrap();
    bridge.ready.remove(window_id);
    let ids: Vec<_> = bridge
        .pending
        .iter()
        .filter(|(_, pending)| pending.window_id == window_id)
        .map(|(id, _)| id.clone())
        .collect();
    for id in &ids {
        bridge.pending.remove(id);
    }
    drop(bridge);
    tauri::async_runtime::spawn_blocking(move || {
        for id in ids {
            if let Ok(dir) = request_dir(&id) {
                let _ = atomic_json(
                    &dir.join("receipt.json"),
                    &Receipt::error(
                        &id,
                        "window_closed",
                        "Target window closed before completion",
                    ),
                );
            }
        }
    });
}

pub fn dispatch_args(app: &tauri::AppHandle, args: &[String]) -> bool {
    if args.get(1).map(String::as_str) != Some(INTERNAL_ARG) {
        return false;
    }
    let Some(id) = args.get(2).cloned() else {
        return true;
    };
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = dispatch(app, &id).await {
            if let Ok(dir) = request_dir(&id) {
                let _ = atomic_json(&dir.join("receipt.json"), &error);
            }
        }
    });
    true
}

async fn dispatch(app: tauri::AppHandle, id: &str) -> Result<(), Receipt> {
    let dir = request_dir(id).map_err(|error| Receipt::error(id, "invalid_request", error))?;
    let bytes = fs::read(dir.join("request.json"))
        .map_err(|error| Receipt::error(id, "invalid_request", error))?;
    let request: Request = serde_json::from_slice(&bytes)
        .map_err(|error| Receipt::error(id, "invalid_request", error))?;
    if request.request_id != id || request.protocol_version != PROTOCOL_VERSION {
        return Err(Receipt::error(
            id,
            "invalid_request",
            "Unsupported request protocol",
        ));
    }
    let mut selected = request.window_id.clone();
    loop {
        if now_ms() >= request.deadline || !dir.exists() {
            return Err(Receipt::error(id, "timeout", "Window did not become ready"));
        }
        if selected.is_none() {
            selected = super::window_manager::get_focused_window(&app)
                .filter(|window| window.label() == "main" || window.label().starts_with("main_"))
                .map(|window| window.label().to_string())
                .or_else(|| {
                    app.get_webview_window("main")
                        .map(|window| window.label().to_string())
                });
        }
        if let Some(window_id) = &selected {
            if let Some(window) = app.get_webview_window(window_id) {
                let ready = bridge()
                    .lock()
                    .map_err(|error| Receipt::error(id, "bridge_unavailable", error))?
                    .ready
                    .contains_key(window_id);
                if ready {
                    if matches!(request.operation.as_str(), "open" | "workspace" | "focus") {
                        window
                            .unminimize()
                            .and_then(|_| window.show())
                            .and_then(|_| window.set_focus())
                            .map_err(|error| Receipt::error(id, "focus_failed", error))?;
                    }
                    {
                        let mut bridge = bridge()
                            .lock()
                            .map_err(|error| Receipt::error(id, "bridge_unavailable", error))?;
                        if bridge.pending.contains_key(id) || dir.join("receipt.json").exists() {
                            return Ok(());
                        }
                        bridge.pending.insert(
                            id.into(),
                            Pending {
                                request: request.clone(),
                                window_id: window_id.clone(),
                            },
                        );
                    }
                    if let Err(error) = window.emit("cli:request", &request) {
                        bridge().lock().unwrap().pending.remove(id);
                        return Err(Receipt::error(id, "delivery_failed", error));
                    }
                    // Expired requests cannot authorize a late export or leak pending state.
                    while now_ms() < request.deadline && dir.exists() {
                        if dir.join("receipt.json").exists() {
                            break;
                        }
                        if app.get_webview_window(window_id).is_none() {
                            bridge().lock().unwrap().pending.remove(id);
                            return Err(Receipt::error(
                                id,
                                "window_closed",
                                "Target window closed before completion",
                            ));
                        }
                        tokio::time::sleep(Duration::from_millis(50)).await;
                    }
                    bridge().lock().unwrap().pending.remove(id);
                    return Ok(());
                }
            } else if request.window_id.is_some() && !app.webview_windows().is_empty() {
                return Err(Receipt::error(
                    id,
                    "window_not_found",
                    format!("Window not found: {window_id}"),
                ));
            }
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
}

fn pending_for(id: &str, window_id: &str) -> Result<Pending, String> {
    let pending = bridge()
        .lock()
        .map_err(|error| error.to_string())?
        .pending
        .get(id)
        .cloned()
        .ok_or("Request is no longer pending")?;
    if pending.window_id != window_id
        || now_ms() >= pending.request.deadline
        || !request_dir(id)?.exists()
    {
        return Err("Request expired or belongs to another window".into());
    }
    Ok(pending)
}

#[tauri::command]
pub fn cli_complete(window: tauri::WebviewWindow, receipt: Receipt) -> Result<(), String> {
    pending_for(&receipt.request_id, window.label())?;
    if receipt.protocol_version != PROTOCOL_VERSION {
        return Err("Unsupported receipt protocol".into());
    }
    atomic_json(
        &request_dir(&receipt.request_id)?.join("receipt.json"),
        &receipt,
    )?;
    bridge()
        .lock()
        .map_err(|error| error.to_string())?
        .pending
        .remove(&receipt.request_id);
    Ok(())
}

fn write_export(request: &Request, content: &[u8]) -> Result<Value, String> {
    if request.operation != "export" {
        return Err("Request is not an export".into());
    }
    let output = Path::new(request.output.as_deref().ok_or("Missing output path")?);
    let source = Path::new(request.path.as_deref().ok_or("Missing source path")?);
    if output == source || same_file::is_same_file(output, source).unwrap_or(false) {
        return Err("Export cannot replace the source file".into());
    }
    let parent = output.parent().ok_or("Missing output directory")?;
    // Require an existing destination directory; never create directories on a failed export.
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|error| error.to_string())?;
    temp.write_all(content).map_err(|error| error.to_string())?;
    temp.as_file()
        .sync_all()
        .map_err(|error| error.to_string())?;
    if now_ms() >= request.deadline {
        return Err("Request expired before export commit".into());
    }
    if request.overwrite {
        temp.persist(output)
    } else {
        temp.persist_noclobber(output)
    }
    .map_err(|error| error.to_string())?;
    let bytes = fs::read(output).map_err(|error| error.to_string())?;
    if bytes != content {
        return Err("Output changed before verification".into());
    }
    Ok(
        json!({ "path": output, "bytes": bytes.len(), "sha256": digest(&bytes), "format": request.format }),
    )
}

#[tauri::command]
pub async fn cli_write_export(
    window: tauri::WebviewWindow,
    request_id: String,
    content: Vec<u8>,
) -> Result<Value, String> {
    let pending = pending_for(&request_id, window.label())?;
    tauri::async_runtime::spawn_blocking(move || write_export(&pending.request, &content))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    fn request(args: &[&str]) -> Request {
        parse(
            &args.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
            Path::new("/work"),
        )
        .unwrap()
    }
    #[test]
    fn history_and_save_parser_separate_session_and_transport_identity() {
        let r = request(&["history", "begin", "a.md", "--request-id", "edit-1"]);
        assert_eq!(r.operation, "historyBegin");
        assert_eq!(r.operation_id.as_deref(), Some("edit-1"));
        assert!(r.request_id.is_empty());
        let hash = "a".repeat(64);
        let r = request(&[
            "history",
            "commit",
            "session-1",
            "--sha256",
            &hash,
            "--message",
            "One task",
        ]);
        assert_eq!(r.session_id.as_deref(), Some("session-1"));
        assert!(r.path.is_none());
        assert!(parse(
            &["file".into(), "save".into(), "a.md".into()],
            Path::new("/tmp")
        )
        .is_err());
        assert!(parse(
            &["history".into(), "begin".into(), "a.md".into()],
            Path::new("/tmp")
        )
        .is_err());
    }

    #[test]
    fn parser_preserves_targets_and_rejects_invalid_options() {
        let parsed = request(&[
            "file",
            "open",
            "a b.md",
            "--window=missing",
            "--preview",
            "--wait",
            "visible",
        ]);
        assert_eq!(
            Path::new(parsed.path.as_ref().unwrap()),
            Path::new("/work").join("a b.md")
        );
        assert_eq!(parsed.window_id.as_deref(), Some("missing"));
        assert!(parsed.preview);
        for args in [
            vec!["file", "open"],
            vec!["file", "open", "a", "--wat"],
            vec!["file", "status", "a", "--preview"],
            vec!["open", "a", "--timeout", "0"],
            vec!["open", "a", "--window", "--preview"],
            vec!["file", "export", "a", "--format", "pdf"],
        ] {
            assert!(parse(
                &args.iter().map(|s| s.to_string()).collect::<Vec<_>>(),
                Path::new("/work")
            )
            .is_err());
        }
    }

    #[test]
    fn old_listener_cleanup_cannot_disable_a_new_ready_listener() {
        let mut state = Bridge::default();
        state.set_ready("main", "old", true);
        state.set_ready("main", "new", true);
        state.set_ready("main", "old", false);
        assert_eq!(state.ready.get("main").map(String::as_str), Some("new"));
        state.set_ready("main", "new", false);
        assert!(!state.ready.contains_key("main"));
    }
    #[test]
    fn receipt_is_atomic_and_cannot_be_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("receipt.json");
        atomic_json(&path, &Receipt::error("cli-test", "read_failed", "no file")).unwrap();
        assert!(atomic_json(&path, &json!({"ok": true})).is_err());
        assert_eq!(
            serde_json::from_slice::<Receipt>(&fs::read(path).unwrap())
                .unwrap()
                .code,
            "read_failed"
        );
        assert!(request_dir("cli-../../escape").is_err());
    }
    #[test]
    fn export_confirms_bytes_and_protects_existing_source_and_expired_requests() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.md");
        let output = dir.path().join("output.html");
        fs::write(&source, "original").unwrap();
        let mut request = request(&[
            "file",
            "export",
            source.to_str().unwrap(),
            "--output",
            output.to_str().unwrap(),
            "--format",
            "html",
        ]);
        let result = write_export(&request, b"exported").unwrap();
        assert_eq!(result["bytes"], 8);
        assert_eq!(result["sha256"], digest(b"exported"));
        assert!(write_export(&request, b"replace").is_err());
        assert_eq!(fs::read(&output).unwrap(), b"exported");
        request.overwrite = true;
        write_export(&request, b"replaced").unwrap();
        request.output = Some(source.to_string_lossy().into_owned());
        assert!(write_export(&request, b"lost").is_err());
        request.output = Some(output.to_string_lossy().into_owned());
        request.deadline = 0;
        assert!(write_export(&request, b"late").is_err());
        assert_eq!(fs::read(&output).unwrap(), b"replaced");
        assert_eq!(fs::read(&source).unwrap(), b"original");
    }

    #[test]
    fn prepares_the_same_decoded_text_as_the_editor_and_rejects_directories() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("bom.md");
        fs::write(&path, b"\xef\xbb\xbf# Notes\r\n").unwrap();
        let mut open = request(&["file", "open", path.to_str().unwrap()]);
        prepare(&mut open).unwrap();
        assert_eq!(open.expected_sha256, Some(digest(b"# Notes\r\n")));
        let mut directory = request(&["file", "open", dir.path().to_str().unwrap()]);
        assert_eq!(
            prepare(&mut directory).unwrap_err().code,
            "unsupported_file"
        );
        let mut workspace = request(&["open", dir.path().to_str().unwrap()]);
        prepare(&mut workspace).unwrap();
        assert_eq!(workspace.operation, "workspace");
    }

    #[test]
    fn export_rejects_aliases_and_reports_html_write_errors() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.md");
        let alias = dir.path().join("alias.html");
        fs::write(&source, b"source").unwrap();
        fs::hard_link(&source, &alias).unwrap();
        let export = request(&[
            "file",
            "export",
            source.to_str().unwrap(),
            "--format",
            "html",
            "--output",
            alias.to_str().unwrap(),
            "--overwrite",
        ]);
        assert!(write_export(&export, b"wrong").is_err());
        assert_eq!(fs::read(&source).unwrap(), b"source");
        assert!(
            super::super::fc::cmd::export_html_to_path("html", dir.path().to_str().unwrap())
                .is_err()
        );
        let output = dir.path().join("literal.html");
        super::super::fc::cmd::export_html_to_path(r#"<pre>\\\"</pre>"#, output.to_str().unwrap())
            .unwrap();
        assert_eq!(fs::read_to_string(output).unwrap(), r#"<pre>\\\"</pre>"#);
    }
}
