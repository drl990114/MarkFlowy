use super::conf;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

static OPENED_CACHE_LOCK: Mutex<()> = Mutex::new(());

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct WorkspaceInfo {
    pub path: String,
}

impl WorkspaceInfo {
    pub fn new(path: String) -> Self {
        Self { path }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OpenedCache {
    recent_workspaces: Vec<WorkspaceInfo>,
}

#[derive(Serialize, Debug, Clone)]
pub struct OpenedCacheReadResult {
    recent_workspaces: Vec<WorkspaceInfo>,
}

impl OpenedCache {
    pub fn new() -> Self {
        Self {
            recent_workspaces: vec![],
        }
    }

    pub fn get_path() -> PathBuf {
        conf::app_root().join("opened_cache.json")
    }

    pub fn add_recent_workspace(mut self, workspace: WorkspaceInfo) -> Self {
        let workspace_path = workspace.path.clone();
        let mut recent_workspaces = self.recent_workspaces.clone();
        if recent_workspaces.len() >= 12 {
            recent_workspaces.pop();
        }
        if let Some(index) = recent_workspaces
            .iter()
            .position(|his| his.path == workspace_path)
        {
            recent_workspaces.remove(index);
        }

        recent_workspaces.insert(0, WorkspaceInfo::new(workspace_path));
        self.recent_workspaces = recent_workspaces;
        self.write()
    }

    pub fn clear_recent_workspaces(mut self) -> Self {
        self.recent_workspaces = vec![];
        self.write()
    }

    fn read_result() -> OpenedCacheReadResult {
        match std::fs::read_to_string(Self::get_path()) {
            Ok(v) => {
                if let Ok(cache) = serde_json::from_str::<OpenedCache>(&v) {
                    OpenedCacheReadResult {
                        recent_workspaces: cache.recent_workspaces,
                    }
                } else {
                    OpenedCacheReadResult {
                        recent_workspaces: vec![],
                    }
                }
            }
            Err(err) => {
                println!("err: {:?}", err);
                OpenedCacheReadResult {
                    recent_workspaces: vec![],
                }
            }
        }
    }

    pub fn read() -> Self {
        let result = Self::read_result();
        Self {
            recent_workspaces: result.recent_workspaces,
        }
    }

    pub fn write(self) -> Self {
        let path = &Self::get_path();
        if let Ok(v) = serde_json::to_string_pretty(&self) {
            std::fs::write(path, v).unwrap_or_else(|err| {
                println!("err: {:?}", err);
            });
        }
        self
    }
}

impl Default for OpenedCache {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::{OpenedCache, OpenedCacheReadResult, WorkspaceInfo, OPENED_CACHE_LOCK};
    use crate::app::startup_io;
    use tauri::command;

    #[command]
    pub async fn get_opened_cache() -> Result<OpenedCacheReadResult, String> {
        startup_io::run(|| {
            let _guard = OPENED_CACHE_LOCK
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            OpenedCache::read_result()
        })
        .await
        .map_err(|error| format!("Failed to join recent-workspace reader: {error}"))
    }

    #[command]
    pub async fn add_recent_workspace(workspace: WorkspaceInfo) -> Result<OpenedCache, String> {
        startup_io::run(move || {
            let _guard = OPENED_CACHE_LOCK
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            OpenedCache::read().add_recent_workspace(workspace)
        })
        .await
        .map_err(|error| format!("Failed to join recent-workspace writer: {error}"))
    }

    #[command]
    pub async fn clear_recent_workspaces() -> Result<OpenedCache, String> {
        startup_io::run(|| {
            let _guard = OPENED_CACHE_LOCK
                .lock()
                .unwrap_or_else(|error| error.into_inner());
            OpenedCache::read().clear_recent_workspaces()
        })
        .await
        .map_err(|error| format!("Failed to join recent-workspace writer: {error}"))
    }
}
