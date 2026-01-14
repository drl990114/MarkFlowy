use crate::WINDOW_INSTANCES;
use serde_json;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use uuid;

use super::conf::AppConf;

#[cfg(target_os = "macos")]
use tauri::TitleBarStyle;

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
pub fn create_new_window(_app: AppHandle, path: Option<String>) -> Result<String, String> {
    let theme = AppConf::theme_mode(&_app.clone());
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
                return Ok(label);
            }
        }
    }

    // 生成唯一的窗口标签
    let window_label = format!("main_{}", uuid::Uuid::new_v4());
    let window_label_clone = window_label.clone(); // 创建克隆用于返回

    // 存储窗口实例信息到全局缓存
    if let Some(path) = &workspace_path {
        let mut instances = WINDOW_INSTANCES
            .lock()
            .map_err(|_| "Failed to lock window instances")?;
        instances.insert(window_label.clone(), path.clone());
    }

    let opened_urls = workspace_path
        .as_ref()
        .map(|p| p.to_str().unwrap_or("").to_string())
        .unwrap_or("".into());

    // 使用JSON序列化确保路径中的特殊字符被正确转义
    let escaped_urls = serde_json::to_string(&opened_urls).unwrap_or_else(|_| opened_urls.clone());

    println!("opened_urls:{}", opened_urls);
    println!("escaped_urls:{}", escaped_urls);
    println!("path:{}", path.as_ref().unwrap());
    tauri::async_runtime::spawn(async move {
        let mut new_win =
            WebviewWindowBuilder::new(&_app, window_label, WebviewUrl::App("index.html".into()))
                .initialization_script(&format!("window.openedUrls = {escaped_urls}"))
                .initialization_script(&format!("console.log('window.openedUrl:{}')", escaped_urls))
                .title("MarkFlowy")
                .resizable(true)
                .fullscreen(false)
                .theme(Some(theme))
                .inner_size(1200.0, 800.0)
                .min_inner_size(400.0, 400.0);

        #[cfg(target_os = "macos")]
        {
            new_win = new_win.title_bar_style(TitleBarStyle::Transparent);
        }

        // #[cfg(not(target_os = "macos"))]
        // {
        //     new_win = new_win.decorations(false);
        // }

        new_win.build().unwrap();
    });

    Ok(window_label_clone)
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

/// 获取最近打开的窗口标签
/// 从WINDOW_INSTANCES中获取最后插入的窗口标签，如果不存在则返回"main"
pub fn get_last_opened_window_label() -> String {
    if let Ok(instances) = WINDOW_INSTANCES.lock() {
        // 获取最后插入的窗口标签（HashMap保持插入顺序）
        if let Some((last_label, _)) = instances.iter().last() {
            return last_label.clone();
        }
    }
    "main".to_string()
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
        Ok(true)
    } else {
        Err("Window not found".to_string())
    }
}
