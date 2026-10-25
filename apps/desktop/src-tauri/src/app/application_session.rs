use serde::{Deserialize, Serialize};
use std::{
    collections::{HashMap, HashSet},
    sync::{LazyLock, Mutex},
};
use tauri::{AppHandle, Manager, WebviewWindow};
use tauri_plugin_store::{Store, StoreBuilder};

const STORE_PATH: &str = ".markflowy_workspaces.dat";
const SESSION_KEY: &str = "window-session:application:v1";
static QUIT_STATE: LazyLock<Mutex<QuitState>> = LazyLock::new(|| Mutex::new(QuitState::default()));

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ApplicationSession {
    version: u8,
    pub windows: Vec<String>,
    pub focused_label: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum SessionReadError {
    #[error("Invalid application window session: {0}")]
    Invalid(String),
    #[error("Failed to read application window session: {0}")]
    Store(String),
}

pub(crate) struct RestoreAttempt {
    pub restored: Vec<(String, String)>,
    pub failed: Vec<(String, String)>,
}

pub(crate) fn is_editor_window(label: &str) -> bool {
    label == "main" || label.starts_with("main_")
}

impl ApplicationSession {
    fn new(windows: impl IntoIterator<Item = String>, focused_label: Option<String>) -> Self {
        let mut windows: Vec<_> = windows
            .into_iter()
            .filter(|label| is_editor_window(label))
            .collect();
        windows.sort();
        windows.dedup();
        let focused_label = focused_label.filter(|label| windows.contains(label));
        Self {
            version: 1,
            windows,
            focused_label,
        }
    }

    fn without_window(mut self, label: &str) -> Self {
        self.windows.retain(|window| window != label);
        if self.focused_label.as_deref() == Some(label) {
            self.focused_label = self.windows.last().cloned();
        }
        self
    }

    pub(crate) fn restore_windows(&self) -> Vec<(String, String)> {
        let needs_main = !self.windows.iter().any(|label| label == "main");
        self.windows
            .iter()
            .enumerate()
            .map(|(index, source)| {
                let target = if needs_main && index == 0 {
                    "main".into()
                } else {
                    source.clone()
                };
                (target, source.clone())
            })
            .collect()
    }

    pub(crate) fn attempt_restore(
        &self,
        mut create: impl FnMut(&str, &str) -> Result<(), String>,
    ) -> RestoreAttempt {
        let mut attempt = RestoreAttempt {
            restored: vec![],
            failed: vec![],
        };
        for (target, source) in self.restore_windows() {
            match create(&target, &source) {
                Ok(()) => attempt.restored.push((target, source)),
                Err(error) => attempt.failed.push((source, error)),
            }
        }
        attempt
    }
}

fn parse_session(
    value: Option<serde_json::Value>,
) -> Result<Option<ApplicationSession>, SessionReadError> {
    let Some(value) = value else { return Ok(None) };
    let session: ApplicationSession = serde_json::from_value(value)
        .map_err(|error| SessionReadError::Invalid(error.to_string()))?;
    if session.version != 1
        || session.windows.iter().any(|label| {
            !is_editor_window(label)
                || !label.chars().all(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '_' | '-')
                })
        })
    {
        return Err(SessionReadError::Invalid(
            "unsupported version or invalid window label".into(),
        ));
    }
    Ok(Some(ApplicationSession::new(
        session.windows,
        session.focused_label,
    )))
}

fn read_session_value(app: &AppHandle) -> Result<Option<serde_json::Value>, SessionReadError> {
    let store = StoreBuilder::new(app, STORE_PATH)
        .disable_auto_save()
        .build()
        .map_err(|error| SessionReadError::Store(error.to_string()))?;
    Ok(store.get(SESSION_KEY))
}

pub(crate) fn read_session(
    app: &AppHandle,
) -> Result<Option<ApplicationSession>, SessionReadError> {
    parse_session(read_session_value(app)?)
}

fn replace_then_save(
    previous: Option<serde_json::Value>,
    next: Option<serde_json::Value>,
    mut replace: impl FnMut(Option<serde_json::Value>),
    save: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    replace(next);
    if let Err(error) = save() {
        // The store is shared by all renderers. Failed native writes must not
        // leak through the next successful renderer save.
        replace(previous);
        return Err(error);
    }
    Ok(())
}

fn write_store_value(
    store: &Store<tauri::Wry>,
    key: &str,
    value: Option<serde_json::Value>,
) -> Result<(), String> {
    replace_then_save(
        store.get(key),
        value,
        |next| {
            if let Some(next) = next {
                store.set(key, next);
            } else {
                store.delete(key);
            }
        },
        || store.save().map_err(|error| error.to_string()),
    )
}

fn save_session_value(app: &AppHandle, value: Option<serde_json::Value>) -> Result<(), String> {
    let store = StoreBuilder::new(app, STORE_PATH)
        .disable_auto_save()
        .build()
        .map_err(|error| error.to_string())?;
    write_store_value(&store, SESSION_KEY, value)
}

fn copy_window_snapshot(
    target: &str,
    source: &str,
    read: impl FnOnce(&str) -> Option<serde_json::Value>,
    write: impl FnOnce(&str, Option<serde_json::Value>) -> Result<(), String>,
) -> Result<(), String> {
    if target == source {
        return Ok(());
    }
    let snapshot = read(&format!("window-session:v1:{source}"))
        .ok_or_else(|| format!("Missing source window session: {source}"))?;
    // Keep the original windowLabel and native draft references: the renderer
    // needs their source ownership while it claims drafts for the new label.
    write(&format!("window-session:v1:{target}"), Some(snapshot))
}

fn prepare_window_snapshot(
    target: &str,
    restore_session_label: &Option<Option<String>>,
    read: impl FnOnce(&str) -> Option<serde_json::Value>,
    write: impl FnOnce(&str, Option<serde_json::Value>) -> Result<(), String>,
) -> Result<(), String> {
    match restore_session_label {
        Some(Some(source)) => copy_window_snapshot(target, source, read, write),
        Some(None) => write(&format!("window-session:v1:{target}"), None),
        None => Ok(()),
    }
}

pub(crate) fn prepare_window_session(
    app: &AppHandle,
    target: &str,
    restore_session_label: &Option<Option<String>>,
) -> Result<(), String> {
    if restore_session_label.is_none() {
        return Ok(());
    }
    let store = StoreBuilder::new(app, STORE_PATH)
        .disable_auto_save()
        .build()
        .map_err(|error| error.to_string())?;
    prepare_window_snapshot(
        target,
        restore_session_label,
        |key| store.get(key),
        |key, value| write_store_value(&store, key, value),
    )
}

fn save_session(app: &AppHandle, session: Option<&ApplicationSession>) -> Result<(), String> {
    save_session_value(
        app,
        session
            .map(serde_json::to_value)
            .transpose()
            .map_err(|error| error.to_string())?,
    )
}

fn session_for_close(value: Option<serde_json::Value>) -> Option<ApplicationSession> {
    match parse_session(value) {
        Ok(session) => session,
        Err(error) => {
            // Closing a live window may replace an unusable manifest. Document
            // snapshots and protected native drafts remain independently stored.
            eprintln!("{error}");
            None
        }
    }
}

#[derive(Default)]
struct QuitState {
    exit_code: Option<i32>,
    restore_aliases: HashMap<String, String>,
    prepared_closes: HashSet<String>,
    unrestored_sources: HashSet<String>,
}

impl QuitState {
    fn capture(
        &self,
        windows: impl IntoIterator<Item = String>,
        focused_label: Option<String>,
    ) -> ApplicationSession {
        ApplicationSession::new(
            windows
                .into_iter()
                .filter(|label| !self.prepared_closes.contains(label))
                .chain(self.unrestored_sources.iter().cloned()),
            focused_label,
        )
    }

    fn begin(
        &mut self,
        code: i32,
        save: impl FnOnce() -> Result<(), String>,
    ) -> Result<bool, String> {
        if self.exit_code.is_some() {
            return Ok(false);
        }
        save()?;
        self.exit_code = Some(code);
        Ok(true)
    }

    fn finish(&mut self, has_editors: bool) -> Option<i32> {
        if has_editors {
            None
        } else {
            self.exit_code.take()
        }
    }

    fn without_window(
        &self,
        session: Option<ApplicationSession>,
        label: &str,
    ) -> ApplicationSession {
        let mut session = session
            .unwrap_or_else(|| ApplicationSession::new([], None))
            .without_window(label);
        if let Some(source) = self.restore_aliases.get(label) {
            session = session.without_window(source);
        }
        session
    }

    fn close_window(
        &mut self,
        label: &str,
        read: impl FnOnce() -> Result<Option<ApplicationSession>, String>,
        mut save: impl FnMut(Option<&ApplicationSession>) -> Result<(), String>,
        destroy: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        if self.exit_code.is_some() {
            return destroy();
        }
        let previous = read()?;
        let next = self.without_window(previous.clone(), label);
        save(Some(&next))?;
        if let Err(error) = destroy() {
            save(previous.as_ref())?;
            return Err(error);
        }
        self.prepared_closes.insert(label.into());
        Ok(())
    }
}

pub(crate) fn register_restore(target: &str, source: &str) {
    QUIT_STATE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .restore_aliases
        .insert(target.into(), source.into());
}

pub(crate) fn retain_failed_restore(source: &str) {
    QUIT_STATE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .unrestored_sources
        .insert(source.into());
}

pub(crate) fn is_quitting() -> bool {
    QUIT_STATE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .exit_code
        .is_some()
}

/// Commit the complete live-window set before any renderer is asked to close.
/// None means an existing quit already owns the close requests.
pub(crate) fn begin_quit(app: &AppHandle, code: i32) -> Result<Option<Vec<String>>, String> {
    let mut state = QUIT_STATE.lock().unwrap_or_else(|error| error.into_inner());
    let session = state.capture(
        app.webview_windows().into_keys(),
        super::window_manager::get_focused_editor_window(app)
            .map(|window| window.label().to_string()),
    );
    if !state.begin(code, || save_session(app, Some(&session)))? {
        return Ok(None);
    }
    Ok(Some(session.windows))
}

#[tauri::command]
pub fn cancel_app_quit() {
    QUIT_STATE
        .lock()
        .unwrap_or_else(|error| error.into_inner())
        .exit_code = None;
}

/// The caller has already flushed document/draft state. Persist an ordinary
/// close before destroying the native window so a failed save leaves it usable.
#[tauri::command]
pub fn close_session_window(window: WebviewWindow) -> Result<(), String> {
    let app = window.app_handle();
    let label = window.label();
    if !is_editor_window(label) {
        return Err("Not an editor window".into());
    }
    let mut state = QUIT_STATE.lock().unwrap_or_else(|error| error.into_inner());
    // Tauri's destroy dispatches an event-loop message without waiting for the
    // Destroyed callback; keeping this lock prevents Quit capturing this close.
    let previous_value = read_session_value(app).map_err(|error| error.to_string())?;
    state.close_window(
        label,
        || Ok(session_for_close(previous_value.clone())),
        |session| match session {
            Some(session) => save_session(app, Some(session)),
            None => save_session_value(app, previous_value.clone()),
        },
        || window.destroy().map_err(|error| error.to_string()),
    )
}

/// Ordinary closes retire only that window. Quit-driven closes keep the frozen
/// manifest while each renderer writes its final document/draft snapshot.
pub(crate) fn window_destroyed(app: &AppHandle, label: &str) -> Result<Option<i32>, String> {
    if !is_editor_window(label) {
        return Ok(None);
    }
    let mut state = QUIT_STATE.lock().unwrap_or_else(|error| error.into_inner());
    let prepared = state.prepared_closes.remove(label);
    if state.exit_code.is_some() {
        let has_editors = app
            .webview_windows()
            .keys()
            .any(|other| other != label && is_editor_window(other));
        return Ok(state.finish(has_editors));
    }
    if prepared {
        state.restore_aliases.remove(label);
        return Ok(None);
    }
    // Persist an explicit empty manifest even on the first ordinary close, so a
    // subsequent cold launch cannot resurrect the legacy last-active snapshot.
    let session = state.without_window(
        session_for_close(read_session_value(app).map_err(|error| error.to_string())?),
        label,
    );
    save_session(app, Some(&session))?;
    state.restore_aliases.remove(label);
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn quit_manifest_includes_single_file_windows_and_excludes_auxiliary_windows() {
        let session = ApplicationSession::new(
            ["main", "main_file", "conf", "mf-pdf-print-1", "main_file"].map(String::from),
            Some("main_file".into()),
        );
        assert_eq!(session.windows, ["main", "main_file"]);
        assert_eq!(session.focused_label.as_deref(), Some("main_file"));
        assert_eq!(
            parse_session(Some(serde_json::to_value(&session).unwrap())).unwrap(),
            Some(session)
        );
    }

    #[test]
    fn missing_legacy_manifest_differs_from_explicit_empty_session() {
        assert_eq!(parse_session(None).unwrap(), None);
        assert_eq!(
            parse_session(Some(json!({"version":1,"windows":[],"focusedLabel":null}))).unwrap(),
            Some(ApplicationSession::new([], None))
        );
    }

    #[test]
    fn single_close_removes_only_that_window_including_main() {
        let session =
            ApplicationSession::new(["main", "main_file"].map(String::from), Some("main".into()));
        let remaining = session.without_window("main");
        assert_eq!(remaining.windows, ["main_file"]);
        assert_eq!(remaining.focused_label.as_deref(), Some("main_file"));
        assert_eq!(
            remaining.without_window("main_file"),
            ApplicationSession::new([], None)
        );
    }

    #[test]
    fn restore_keeps_each_source_but_assigns_main_when_the_original_main_was_closed() {
        let session = ApplicationSession::new(
            ["main_first", "main_second"].map(String::from),
            Some("main_first".into()),
        );
        assert_eq!(
            session.restore_windows(),
            [
                ("main".into(), "main_first".into()),
                ("main_second".into(), "main_second".into())
            ]
        );
        let mut state = QuitState::default();
        state
            .restore_aliases
            .insert("main".into(), "main_first".into());
        assert_eq!(
            state.without_window(Some(session), "main").windows,
            ["main_second"]
        );
        assert_eq!(
            state.without_window(None, "main"),
            ApplicationSession::new([], None)
        );
    }

    #[test]
    fn failed_manifest_save_does_not_begin_quit_or_issue_close_requests() {
        let mut state = QuitState::default();
        assert!(state.begin(0, || Err("disk full".into())).is_err());
        assert_eq!(state.exit_code, None);
        assert!(state.begin(0, || Ok(())).unwrap());
    }

    #[test]
    fn manual_close_save_failure_leaves_the_window_alive() {
        let mut state = QuitState::default();
        let result = state.close_window(
            "main",
            || Ok(None),
            |_| Err("disk full".into()),
            || panic!("window must remain alive"),
        );
        assert_eq!(result, Err("disk full".into()));
        assert!(state.prepared_closes.is_empty());
    }

    #[test]
    fn failed_native_destroy_rolls_back_the_original_manifest() {
        let mut state = QuitState::default();
        let original = ApplicationSession::new(["main", "main_file"].map(String::from), None);
        let mut saved = vec![];
        let result = state.close_window(
            "main",
            || Ok(Some(original.clone())),
            |session| {
                saved.push(session.cloned());
                Ok(())
            },
            || Err("native teardown failed".into()),
        );
        assert!(result.is_err());
        assert_eq!(
            saved,
            [
                Some(original.clone().without_window("main")),
                Some(original)
            ]
        );
        assert!(state.prepared_closes.is_empty());
    }

    #[test]
    fn quit_excludes_a_manual_close_waiting_for_its_destroyed_event() {
        let mut state = QuitState::default();
        state
            .close_window("main_file", || Ok(None), |_| Ok(()), || Ok(()))
            .unwrap();
        assert_eq!(
            state.capture(
                ["main", "main_file"].map(String::from),
                Some("main_file".into())
            ),
            ApplicationSession::new(["main".into()], None)
        );
    }

    #[test]
    fn quit_close_does_not_retire_a_window_from_the_frozen_manifest() {
        let mut state = QuitState::default();
        state.begin(0, || Ok(())).unwrap();
        state
            .close_window(
                "main",
                || panic!("do not reread the manifest"),
                |_| panic!("do not overwrite the manifest"),
                || Ok(()),
            )
            .unwrap();
        assert!(state.prepared_closes.is_empty());
    }

    #[test]
    fn duplicate_quit_is_idempotent_and_finishes_after_the_last_editor() {
        let mut state = QuitState::default();
        assert!(state.begin(3, || Ok(())).unwrap());
        assert!(!state
            .begin(9, || panic!("must not overwrite the frozen manifest"))
            .unwrap());
        assert_eq!(state.finish(true), None);
        assert_eq!(state.finish(false), Some(3));
        assert_eq!(state.finish(false), None);
    }

    #[test]
    fn cancelled_quit_allows_a_later_quit_to_capture_a_fresh_manifest() {
        let mut state = QuitState::default();
        assert!(state.begin(0, || Ok(())).unwrap());
        state.exit_code = None;
        assert_eq!(state.finish(false), None);
        assert!(state.begin(1, || Ok(())).unwrap());
        assert_eq!(state.finish(false), Some(1));
    }

    #[test]
    fn invalid_manifest_is_not_silently_treated_as_a_legacy_launch() {
        assert!(parse_session(Some(json!({"version":2,"windows":[]}))).is_err());
        assert!(parse_session(Some(json!({"version":1,"windows":["conf"]}))).is_err());
        assert!(parse_session(Some(json!({"version":1,"windows":["main_/bad"]}))).is_err());
    }

    #[test]
    fn corrupt_manifest_can_be_replaced_by_an_explicit_empty_close() {
        let corrupt = json!({ "version": 99, "windows": ["main"] });
        assert!(matches!(
            parse_session(Some(corrupt.clone())),
            Err(SessionReadError::Invalid(_))
        ));
        let state = QuitState::default();
        assert_eq!(
            state.without_window(session_for_close(Some(corrupt)), "main"),
            ApplicationSession::new([], None)
        );
    }

    #[test]
    fn failed_window_creation_does_not_stop_other_restores_or_consume_the_manifest() {
        let session =
            ApplicationSession::new(["main", "main_file"].map(String::from), Some("main".into()));
        let original = session.clone();
        let attempt = session.attempt_restore(|target, _| {
            if target == "main" {
                Err("webview failed".into())
            } else {
                Ok(())
            }
        });
        assert_eq!(attempt.restored, [("main_file".into(), "main_file".into())]);
        assert_eq!(attempt.failed, [("main".into(), "webview failed".into())]);
        assert_eq!(session, original);
        let mut state = QuitState::default();
        state.unrestored_sources.insert("main".into());
        assert_eq!(
            state.capture(["main_file".into()], None).windows,
            ["main", "main_file"]
        );
        assert_eq!(
            state.without_window(Some(session), "main_file").windows,
            ["main"]
        );
    }

    #[test]
    fn remapped_window_replaces_a_stale_main_snapshot_before_the_renderer_starts() {
        use std::cell::RefCell;
        let source = json!({
            "version": 1, "windowLabel": "main_file", "files": [{"id":"draft","name":"Untitled"}],
            "drafts": {"version":2,"documents":[{"id":"draft","source":{"kind":"native","draft":{"writer":"main_file:draft"}}}]},
            "editorLayout": {"type":"leaf","id":"group","opened":["draft"],"activeId":"draft"}
        });
        let values = RefCell::new(HashMap::from([
            ("window-session:v1:main_file".to_string(), source.clone()),
            (
                "window-session:v1:main".to_string(),
                json!({"windowLabel":"stale-main"}),
            ),
        ]));
        copy_window_snapshot(
            "main",
            "main_file",
            |key| values.borrow().get(key).cloned(),
            |key, value| {
                values.borrow_mut().insert(key.into(), value.unwrap());
                Ok(())
            },
        )
        .unwrap();
        assert_eq!(values.borrow()["window-session:v1:main"], source);
        assert_eq!(values.borrow()["window-session:v1:main_file"], source);
    }

    #[test]
    fn failed_snapshot_copy_restores_the_shared_cache_before_any_later_save() {
        use std::cell::RefCell;
        let previous = Some(json!({"windowLabel":"old-main"}));
        let cache = RefCell::new(previous.clone());
        let result = copy_window_snapshot(
            "main",
            "main_file",
            |_| Some(json!({"windowLabel":"main_file"})),
            |_, next| {
                replace_then_save(
                    previous.clone(),
                    next,
                    |value| *cache.borrow_mut() = value,
                    || Err("disk full".into()),
                )
            },
        );
        assert_eq!(result, Err("disk full".into()));
        assert_eq!(*cache.borrow(), previous);
        assert!(copy_window_snapshot(
            "main",
            "missing",
            |_| None,
            |_, _| panic!("must not replace a snapshot without its source")
        )
        .is_err());
    }

    #[test]
    fn fresh_window_clears_only_its_old_snapshot_before_it_can_be_quit() {
        use std::cell::RefCell;
        let cache = RefCell::new(HashMap::from([
            (
                "window-session:v1:main".to_string(),
                json!({"windowLabel":"old-main"}),
            ),
            (
                "draft-session:main:retained".to_string(),
                json!({"documents":["protected"]}),
            ),
        ]));
        prepare_window_snapshot(
            "main",
            &Some(None),
            |_| panic!("no source to copy"),
            |key, next| {
                assert!(next.is_none());
                cache.borrow_mut().remove(key);
                Ok(())
            },
        )
        .unwrap();
        assert!(!cache.borrow().contains_key("window-session:v1:main"));
        assert!(cache.borrow().contains_key("draft-session:main:retained"));
    }

    #[test]
    fn failed_fresh_window_preparation_restores_the_old_snapshot() {
        use std::cell::RefCell;
        let previous = Some(json!({"windowLabel":"old-main"}));
        let cache = RefCell::new(previous.clone());
        let result = prepare_window_snapshot(
            "main",
            &Some(None),
            |_| None,
            |_, next| {
                replace_then_save(
                    previous.clone(),
                    next,
                    |value| *cache.borrow_mut() = value,
                    || Err("disk full".into()),
                )
            },
        );
        assert!(result.is_err());
        assert_eq!(*cache.borrow(), previous);
    }
}
