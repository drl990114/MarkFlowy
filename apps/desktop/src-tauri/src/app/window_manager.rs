use crate::WINDOW_INSTANCES;
use serde::Serialize;
use std::{path::PathBuf, sync::Mutex, sync::OnceLock, time::Instant};
use tauri::{command, AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
use uuid;

use super::conf::{AppConf, StartupAppearance};

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

fn get_webview_url(path: &str) -> WebviewUrl {
    if tauri::is_dev() {
        WebviewUrl::External(format!("http://localhost:3000/{}", path).parse().unwrap())
    } else {
        WebviewUrl::App(path.into())
    }
}

static APP_SESSION_ID: OnceLock<String> = OnceLock::new();
static WINDOW_RECENCY: Mutex<Vec<String>> = Mutex::new(Vec::new());

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowBootstrap {
    session_id: String,
    opened_urls: Vec<String>,
    appearance: StartupAppearance,
}

fn app_session_id() -> &'static str {
    APP_SESSION_ID
        .get_or_init(|| uuid::Uuid::new_v4().to_string())
        .as_str()
}

pub(crate) fn should_persist_window_state(label: &str) -> bool {
    matches!(label, "main" | "conf")
}

fn update_window_recency(recency: &mut Vec<String>, label: &str) {
    recency.retain(|existing| existing != label);
    recency.push(label.to_string());
}

pub(crate) fn mark_window_recent(label: &str) {
    let mut recency = WINDOW_RECENCY
        .lock()
        .unwrap_or_else(|error| error.into_inner());
    update_window_recency(&mut recency, label);
}

pub(crate) fn forget_window_recency(label: &str) {
    WINDOW_RECENCY
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .retain(|existing| existing != label);
}

pub(crate) fn serialize_javascript_value<T: Serialize>(
    value: &T,
) -> Result<String, serde_json::Error> {
    let serialized = serde_json::to_string(value)?;

    Ok(serialized
        .replace('<', "\\u003c")
        .replace('\u{2028}', "\\u2028")
        .replace('\u{2029}', "\\u2029"))
}

pub(crate) fn serialize_javascript_string(value: &str) -> Result<String, serde_json::Error> {
    serialize_javascript_value(&value)
}

pub(crate) fn window_initialization_script(
    app: &AppHandle,
    opened_urls: Vec<String>,
) -> Result<(String, StartupAppearance), serde_json::Error> {
    let appearance = AppConf::startup_appearance(app);
    let bootstrap = WindowBootstrap {
        session_id: app_session_id().to_string(),
        opened_urls,
        appearance: appearance.clone(),
    };
    let serialized_bootstrap = serialize_javascript_value(&bootstrap)?;

    Ok((
        format!(
            "window.__MARKFLOWY_BOOTSTRAP__ = {serialized_bootstrap};window.openedUrls = window.__MARKFLOWY_BOOTSTRAP__.openedUrls;"
        ),
        appearance,
    ))
}

pub(crate) fn build_main_window(
    app: &AppHandle,
    window_label: String,
    url: WebviewUrl,
    opened_urls: Vec<String>,
) -> Result<WebviewWindow, String> {
    let started_at = Instant::now();
    let (initialization_script, appearance) =
        window_initialization_script(app, opened_urls).map_err(|error| error.to_string())?;
    let native_theme = appearance.preference.native_window_theme();
    let background_color = appearance.palette.surface_color();

    let mut window_builder = WebviewWindowBuilder::new(app, window_label, url)
        .initialization_script(&initialization_script)
        .title("MarkFlowy")
        .resizable(true)
        .fullscreen(false)
        .theme(native_theme)
        .background_color(background_color)
        .disable_drag_drop_handler()
        .inner_size(1200.0, 800.0)
        .min_inner_size(400.0, 400.0);

    #[cfg(target_os = "macos")]
    {
        window_builder = window_builder
            .title_bar_style(TitleBarStyle::Overlay)
            .hidden_title(true);
    }

    #[cfg(target_os = "windows")]
    {
        window_builder = window_builder.decorations(false);
    }

    let window = window_builder.build().map_err(|error| error.to_string())?;
    mark_window_recent(window.label());
    tracing::info!(
        marker = "window-built",
        label = %window.label(),
        elapsed_ms = started_at.elapsed().as_millis() as u64,
        "Startup window built"
    );
    Ok(window)
}

/// 获取所有窗口实例信息
#[command]
pub fn get_window_instances() -> Result<std::collections::HashMap<String, String>, String> {
    let instances = WINDOW_INSTANCES
        .lock()
        .map_err(|_| "Failed to lock window instances")?;

    // 将 PathBuf 转换为 String
    let result: std::collections::HashMap<String, String> = instances
        .iter()
        .map(|(label, path)| (label.clone(), path.to_str().unwrap_or("").to_string()))
        .collect();

    Ok(result)
}

/// 创建新窗口
#[command]
pub async fn create_new_window(_app: AppHandle, path: Option<String>) -> Result<String, String> {
    let workspace_path = path.clone().map(PathBuf::from);

    // 检查是否已存在打开相同路径的窗口
    if let Some(ref target_path) = workspace_path {
        let instances = WINDOW_INSTANCES
            .lock()
            .map_err(|_| "Failed to lock window instances")?;

        // 查找是否有相同路径的窗口
        let mut stale_labels: Vec<String> = Vec::new();
        let mut existing_window_label: Option<String> = None;

        for (existing_label, existing_path) in instances.iter() {
            if existing_path == target_path {
                if _app.get_webview_window(existing_label).is_some() {
                    // 窗口存在，记录标签
                    existing_window_label = Some(existing_label.clone());
                } else {
                    // 窗口不存在，记录为过期条目
                    stale_labels.push(existing_label.clone());
                }
            }
        }

        // 释放读锁，准备可能的写操作
        drop(instances);

        // 删除过期条目
        if !stale_labels.is_empty() {
            let mut instances = WINDOW_INSTANCES
                .lock()
                .map_err(|_| "Failed to lock window instances")?;

            for stale_label in stale_labels {
                instances.remove(&stale_label);
            }
        }

        // 如果找到存在的窗口，聚焦并返回
        if let Some(label) = existing_window_label {
            if let Some(existing_window) = _app.get_webview_window(&label) {
                existing_window.set_focus().map_err(|e| e.to_string())?;
                mark_window_recent(&label);
                return Ok(label);
            }
        }
    }

    // 生成唯一的窗口标签
    let window_label = format!("main_{}", uuid::Uuid::new_v4());

    let opened_urls = workspace_path
        .as_ref()
        .and_then(|path| path.to_str())
        .map(|path| vec![path.to_string()])
        .unwrap_or_default();

    build_main_window(
        &_app,
        window_label.clone(),
        get_webview_url("index.html"),
        opened_urls,
    )?;

    // Only publish the window after the native/webview build succeeded.
    if let Some(path) = workspace_path {
        let mut instances = WINDOW_INSTANCES
            .lock()
            .map_err(|_| "Failed to lock window instances")?;
        instances.insert(window_label.clone(), path);
    }

    Ok(window_label)
}

/// 更新窗口实例对应的路径
#[command]
pub fn update_window_path(
    _app: AppHandle,
    window_label: &str,
    new_path: Option<String>,
) -> Result<bool, String> {
    let mut instances = WINDOW_INSTANCES
        .lock()
        .map_err(|_| "Failed to lock window instances")?;

    // 检查窗口是否存在
    if _app.get_webview_window(window_label).is_none() {
        return Err("Window not found".to_string());
    }

    // 更新路径
    if let Some(path) = new_path {
        instances.insert(window_label.to_string(), PathBuf::from(path));
    } else {
        instances.remove(window_label);
    }

    Ok(true)
}

/// 根据路径检查是否有活跃的窗口，有则返回窗口标签
#[command]
pub fn check_window_by_path(_app: AppHandle, path: String) -> Result<Option<String>, String> {
    let target_path = PathBuf::from(path);
    let instances = WINDOW_INSTANCES
        .lock()
        .map_err(|_| "Failed to lock window instances")?;

    // 查找是否有相同路径的活跃窗口
    for (existing_label, existing_path) in instances.iter() {
        if existing_path == &target_path {
            // 检查窗口是否仍然存在
            if _app.get_webview_window(existing_label).is_some() {
                return Ok(Some(existing_label.clone()));
            }
        }
    }

    Ok(None)
}

/// 获取最近激活的窗口标签。
pub fn get_last_opened_window_label() -> String {
    WINDOW_RECENCY
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .last()
        .cloned()
        .unwrap_or_else(|| "main".to_string())
}

/// 获取最近打开的窗口
/// 从WINDOW_INSTANCES中获取最后插入的窗口，如果不存在则返回None
pub fn get_last_opened_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    let label = get_last_opened_window_label();
    app.get_webview_window(&label)
}

pub fn get_focused_window(app: &AppHandle) -> Option<tauri::WebviewWindow> {
    if let Ok(instances) = WINDOW_INSTANCES.lock() {
        for (window_label, _) in instances.iter() {
            if let Some(window) = app.get_webview_window(window_label) {
                if window.is_focused().unwrap_or(false) {
                    return Some(window);
                }
            }
        }
    }

    get_last_opened_window(app)
}

/// 聚焦指定标签的窗口
#[command]
pub fn focus_window_by_label(_app: AppHandle, window_label: String) -> Result<bool, String> {
    if let Some(window) = _app.get_webview_window(&window_label) {
        window.set_focus().map_err(|e| e.to_string())?;
        mark_window_recent(&window_label);
        Ok(true)
    } else {
        Err("Window not found".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        serialize_javascript_string, serialize_javascript_value, should_persist_window_state,
        update_window_recency, WindowBootstrap,
    };
    use crate::app::conf::{
        ResolvedThemeMode, StartupAppearance, StartupPalette, ThemePreference,
        STARTUP_APPEARANCE_SCHEMA_VERSION,
    };

    fn test_appearance() -> StartupAppearance {
        StartupAppearance {
            schema_version: STARTUP_APPEARANCE_SCHEMA_VERSION,
            theme_id: "MarkFlowy Dark".to_string(),
            preference: ThemePreference::Dark,
            resolved_mode: ResolvedThemeMode::Dark,
            palette: StartupPalette {
                surface_app: "#131313".to_string(),
                surface_panel: "#1E1D1E".to_string(),
                surface_toolbar: "#323232".to_string(),
                foreground: "#CACCCA".to_string(),
                muted_foreground: "#9E9E9E".to_string(),
                border: "#404040".to_string(),
                accent: "#3794FF".to_string(),
            },
        }
    }

    #[test]
    fn javascript_string_round_trips_paths_with_script_characters() {
        let path = "/tmp/project'); globalThis.injected = true; //\n\"quoted\"\\folder";
        let serialized_path = serialize_javascript_string(path).unwrap();

        assert_eq!(
            serde_json::from_str::<String>(&serialized_path).unwrap(),
            path
        );
    }

    #[test]
    fn javascript_string_escapes_raw_script_terminators() {
        let path = "/tmp/</script><script>globalThis.injected = true</script>.md";
        let serialized_path = serialize_javascript_string(path).unwrap();

        assert!(!serialized_path.contains('<'));
        assert!(serialized_path.contains("\\u003c/script>"));
        assert_eq!(
            serde_json::from_str::<String>(&serialized_path).unwrap(),
            path
        );
    }

    #[test]
    fn javascript_string_escapes_unicode_line_separators() {
        let path = "/tmp/line\u{2028}paragraph\u{2029}separator.md";
        let serialized_path = serialize_javascript_string(path).unwrap();

        assert!(!serialized_path.contains('\u{2028}'));
        assert!(!serialized_path.contains('\u{2029}'));
        assert!(serialized_path.contains("\\u2028"));
        assert!(serialized_path.contains("\\u2029"));
        assert_eq!(
            serde_json::from_str::<String>(&serialized_path).unwrap(),
            path
        );
    }

    #[test]
    fn bootstrap_uses_the_expected_camel_case_contract_and_safe_json() {
        let bootstrap = WindowBootstrap {
            session_id: "session-1".to_string(),
            opened_urls: vec![
                "file:///tmp/notes,2026.md".to_string(),
                "file:///tmp/</script>.md".to_string(),
            ],
            appearance: test_appearance(),
        };

        let serialized = serialize_javascript_value(&bootstrap).unwrap();
        assert!(!serialized.contains('<'));
        let value: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert_eq!(value["sessionId"], "session-1");
        assert_eq!(
            value["openedUrls"],
            serde_json::json!(["file:///tmp/notes,2026.md", "file:///tmp/</script>.md"])
        );
        assert_eq!(value["appearance"]["schemaVersion"], 1);
        assert_eq!(value["appearance"]["resolvedMode"], "dark");
        assert_eq!(value["appearance"]["palette"]["surfaceApp"], "#131313");
    }

    #[test]
    fn window_state_only_tracks_stable_reusable_labels() {
        assert!(should_persist_window_state("main"));
        assert!(should_persist_window_state("conf"));
        assert!(!should_persist_window_state(
            "main_550e8400-e29b-41d4-a716-446655440000"
        ));
        assert!(!should_persist_window_state("mf-pdf-print-1"));
    }

    #[test]
    fn explicit_window_recency_is_deterministic() {
        let mut recency = vec![];
        update_window_recency(&mut recency, "main");
        update_window_recency(&mut recency, "main_B");
        update_window_recency(&mut recency, "main_A");
        update_window_recency(&mut recency, "main_B");

        assert_eq!(recency, vec!["main", "main_A", "main_B"]);
    }
}
