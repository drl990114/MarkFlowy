use crate::app::{application_session, window_manager};
use tauri::{utils::config::WebviewUrl, AppHandle, Emitter, Manager};

pub fn init(
    app_handle: AppHandle,
    opened_urls: Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    // 首先检查是否已经存在窗口
    if let Some(existing_window) = window_manager::get_last_opened_window(&app_handle) {
        // The existing renderer may not have consumed its initial paths yet.
        // Merge only the pending paths; never replace its appearance/session bootstrap.
        crate::update_window_opened_urls(&existing_window, &opened_urls);
        let _ = existing_window.emit("opened-urls", opened_urls.clone());

        // 确保窗口被聚焦
        let _ = existing_window.set_focus();
        return Ok(());
    }

    if opened_urls.is_empty() {
        let session = match application_session::read_session(&app_handle) {
            Ok(session) => session,
            Err(error) => {
                // Keep the unusable manifest and its source snapshots intact.
                // The editor can still open, and must not run legacy recovery.
                eprintln!("{error}");
                window_manager::build_main_window(
                    &app_handle,
                    format!("main_recovery_{}", uuid::Uuid::new_v4()),
                    WebviewUrl::App("index.html".into()),
                    Vec::new(),
                    Some(None),
                )
                .map_err(std::io::Error::other)?;
                return Ok(());
            }
        };
        if let Some(session) = session {
            if !session.windows.is_empty() {
                // Preserve source labels for draft/layout ownership. If the old
                // main was closed, one restored window takes its app duties.
                // Do not consume the manifest: a failed build must be retryable.
                let attempt = session.attempt_restore(|label, source| {
                    window_manager::build_main_window(
                        &app_handle,
                        label.to_string(),
                        WebviewUrl::App("index.html".into()),
                        Vec::new(),
                        Some(Some(source.to_string())),
                    )
                    .map(|_| ())
                });
                for (label, source) in &attempt.restored {
                    application_session::register_restore(label, source);
                }
                for (source, error) in &attempt.failed {
                    eprintln!("Failed to restore window {source}: {error}");
                    application_session::retain_failed_restore(source);
                }
                if attempt.restored.is_empty() {
                    // A fresh label avoids overwriting any failed source snapshot.
                    window_manager::build_main_window(
                        &app_handle,
                        format!("main_recovery_{}", uuid::Uuid::new_v4()),
                        WebviewUrl::App("index.html".into()),
                        Vec::new(),
                        Some(None),
                    )
                    .map_err(std::io::Error::other)?;
                }
                if let Some(window) = session
                    .focused_label
                    .and_then(|source| {
                        attempt
                            .restored
                            .iter()
                            .find(|(_, previous)| previous == &source)
                    })
                    .and_then(|(label, _)| app_handle.get_webview_window(label))
                {
                    let _ = window.set_focus();
                    window_manager::mark_window_recent(window.label());
                }
                return Ok(());
            }
            window_manager::build_main_window(
                &app_handle,
                "main".to_string(),
                WebviewUrl::App("index.html".into()),
                Vec::new(),
                Some(None),
            )
            .map_err(std::io::Error::other)?;
            return Ok(());
        }
    }

    let restore_session_label = if opened_urls.is_empty() {
        None
    } else {
        Some(None)
    };
    let window = window_manager::build_main_window(
        &app_handle,
        "main".to_string(),
        WebviewUrl::App("index.html".into()),
        opened_urls.clone(),
        restore_session_label,
    )
    .map_err(std::io::Error::other)?;

    // 将初始窗口添加到全局窗口实例缓存中
    let window_label = window.label().to_string();
    let workspace_path = opened_urls.first().cloned().unwrap_or_default();

    // 存储窗口实例信息到全局缓存
    if !workspace_path.is_empty() {
        use crate::WINDOW_INSTANCES;
        use std::path::PathBuf;

        let mut instances = WINDOW_INSTANCES
            .lock()
            .map_err(|e| format!("Failed to lock window instances: {}", e))?;
        instances.insert(window_label, PathBuf::from(workspace_path));
    }

    Ok(())
}
