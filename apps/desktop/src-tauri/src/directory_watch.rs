use std::path::{Component, PathBuf};
use tauri::{fs::Pattern, ipc::CapabilityBuilder, Manager, Runtime, Webview};

/// Give the existing fs watcher one literal directory in the requesting webview.
/// Other filesystem commands continue to use their own scopes.
#[tauri::command]
pub(crate) async fn allow_hidden_directory_watch<R: Runtime>(
    webview: Webview<R>,
    directory: PathBuf,
) -> Result<bool, String> {
    if !directory.is_absolute() {
        return Ok(false);
    }
    let directory = tokio::fs::canonicalize(directory)
        .await
        .map_err(|error| error.to_string())?;
    if !directory.components().any(|component| {
        matches!(component, Component::Normal(name) if name.as_encoded_bytes().starts_with(b"."))
    }) || !tokio::fs::metadata(&directory)
        .await
        .map_err(|error| error.to_string())?
        .is_dir()
    {
        return Ok(false);
    }

    let Some(scope) = webview
        .resolve_command_scope::<serde_json::Value>("fs", "watch")
        .map_err(|error| error.to_string())?
    else {
        return Ok(false);
    };
    let path = directory.to_str().ok_or("Watch path is not valid UTF-8")?;
    let literal = Pattern::escape(path);
    if !scope
        .command_scope()
        .allows()
        .iter()
        .any(|entry| entry.as_str() == Some(&literal))
    {
        webview
            .add_capability(
                CapabilityBuilder::new("opened-directory-watch")
                    .webview(Pattern::escape(webview.label()))
                    .permission_scoped("fs:allow-watch", vec![literal], vec![]),
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(true)
}

#[cfg(all(test, unix))]
mod tests {
    use serde_json::{json, Value};
    use std::{fs, path::Path, sync::mpsc, time::Duration};
    use tauri::{
        ipc::{CallbackFn, InvokeBody, InvokeResponseBody},
        test::{get_ipc_response, mock_builder, MockRuntime, INVOKE_KEY},
        webview::InvokeRequest,
        WebviewWindow, WebviewWindowBuilder,
    };

    fn invoke(window: &WebviewWindow<MockRuntime>, cmd: &str, body: Value) -> Result<Value, Value> {
        get_ipc_response(
            window,
            InvokeRequest {
                cmd: cmd.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: InvokeBody::Json(body),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        )
        .map(|response| response.deserialize().unwrap())
    }

    fn watch(window: &WebviewWindow<MockRuntime>, path: &Path) -> Result<Value, Value> {
        invoke(
            window,
            "plugin:fs|watch",
            json!({
                "paths": [path], "options": { "recursive": false, "delayMs": 100 },
                "onEvent": "__CHANNEL__:17"
            }),
        )
    }

    #[test]
    fn grants_only_the_open_windows_literal_directory_and_receives_writes_after_replacement() {
        let (send, events) = mpsc::channel();
        let app = mock_builder()
            .plugin(tauri_plugin_fs::init())
            .invoke_handler(tauri::generate_handler![
                super::allow_hidden_directory_watch
            ])
            .channel_interceptor(move |_, callback, _, data| {
                if let (CallbackFn(17), InvokeResponseBody::Json(body)) = (callback, data) {
                    let event: Value = serde_json::from_str(body).unwrap();
                    let _ = send.send(event);
                }
                true
            })
            .build(crate::app_context())
            .unwrap();
        let owner = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .unwrap();
        let other = WebviewWindowBuilder::new(&app, "main_other", Default::default())
            .build()
            .unwrap();
        let temp = tempfile::tempdir().unwrap();
        let parent = temp.path().canonicalize().unwrap().join(".notes/.year");
        let selected = parent.join("project[1]");
        let sibling = parent.join("project1");
        fs::create_dir_all(&selected).unwrap();
        fs::create_dir(&sibling).unwrap();
        let document = selected.join("daily.md");
        fs::write(&document, "original").unwrap();

        let denied = |result: Result<Value, Value>| {
            let error = result.unwrap_err();
            assert!(error.to_string().contains("forbidden path"), "{error}");
        };
        denied(watch(&owner, &selected));
        assert_eq!(
            invoke(
                &owner,
                "allow_hidden_directory_watch",
                json!({ "directory": selected })
            ),
            Ok(json!(true))
        );
        denied(watch(&owner, &sibling));
        denied(watch(&other, &selected));
        denied(invoke(
            &owner,
            "plugin:fs|read_dir",
            json!({ "path": selected }),
        ));
        denied(invoke(
            &owner,
            "plugin:fs|read_text_file",
            json!({ "path": document }),
        ));

        let resource = watch(&owner, &selected).unwrap();
        let await_write = || {
            let deadline = std::time::Instant::now() + Duration::from_secs(8);
            loop {
                let event = events
                    .recv_timeout(deadline.saturating_duration_since(std::time::Instant::now()))
                    .unwrap();
                if event["paths"]
                    .as_array()
                    .unwrap()
                    .contains(&json!(document))
                {
                    break;
                }
            }
        };
        fs::write(&document, "external").unwrap();
        await_write();
        let replacement = selected.join("new.md");
        fs::write(&replacement, "replacement").unwrap();
        fs::rename(&replacement, &document).unwrap();
        await_write();
        fs::write(&document, "still watched").unwrap();
        await_write();
        invoke(&owner, "plugin:resources|close", json!({ "rid": resource })).unwrap();
    }
}
