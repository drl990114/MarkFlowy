//! Compiled only into the explicitly requested E2E binary. Never use the user's profile.
use std::{path::PathBuf, sync::OnceLock};
use tauri::Manager;

struct Environment {
    root: PathBuf,
    id: uuid::Uuid,
}

static ENVIRONMENT: OnceLock<Environment> = OnceLock::new();

pub fn initialize() {
    let raw = std::env::var_os("MARKFLOWY_E2E_ROOT")
        .expect("E2E binary requires a runner-owned MARKFLOWY_E2E_ROOT");
    let root = PathBuf::from(raw);
    assert!(root.is_absolute(), "E2E root must be absolute");
    let root = root.canonicalize().expect("E2E root must already exist");
    let marker = std::fs::read_to_string(root.join(".markflowy-e2e"))
        .expect("E2E root must contain the runner ownership marker");
    let id = uuid::Uuid::parse_str(marker.trim()).expect("E2E marker must contain a UUID");
    assert_eq!(
        std::env::var("MARKFLOWY_E2E_ID").ok().as_deref(),
        Some(id.to_string().as_str()),
        "E2E root does not belong to this run"
    );
    ENVIRONMENT
        .set(Environment { root, id })
        .ok()
        .expect("E2E initialized twice");
}

pub fn root() -> PathBuf {
    ENVIRONMENT
        .get()
        .expect("E2E environment not initialized")
        .root
        .clone()
}

pub fn identifier() -> String {
    format!(
        "com.drl990114.markflowy.e2e.{}",
        ENVIRONMENT.get().unwrap().id.simple()
    )
}

#[cfg(target_os = "macos")]
pub fn data_store_identifier() -> [u8; 16] {
    *ENVIRONMENT.get().unwrap().id.as_bytes()
}

pub fn record_profile(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Plugins resolve these paths from the unique identifier configured before Builder starts.
    let paths = vec![
        app.path().app_config_dir()?,
        app.path().app_data_dir()?,
        app.path().app_local_data_dir()?,
        app.path().app_cache_dir()?,
    ];
    std::fs::write(
        root().join("native-profile.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "identifier": identifier(), "pid": std::process::id(), "paths": paths,
        }))?,
    )?;
    Ok(())
}

// Diagnostics only. Editing and saving still go through normal UI/keyboard handlers.
pub const INITIALIZATION_SCRIPT: &str = r#"
(() => {
  const errors = [];
  Object.defineProperty(window, '__MARKFLOWY_E2E__', { value: { errors } });
  window.addEventListener('error', (event) => errors.push(String(event.error?.stack || event.message)));
  window.addEventListener('unhandledrejection', (event) => errors.push(String(event.reason?.stack || event.reason)));
})();
"#;
