use super::conf;
use crate::fc::{create_file, exists};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

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

impl OpenedCache {
    pub fn new() -> Self {
        let path = &Self::get_path();
        if !exists(path) {
            create_file(path);
        }

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
        if recent_workspaces.len() > 12 {
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

    pub fn read() -> Self {
        match std::fs::read_to_string(Self::get_path()) {
            Ok(v) => {
                if let Ok(mut v2) = serde_json::from_str::<OpenedCache>(&v) {
                    v2.recent_workspaces
                        .retain(|item| exists(Path::new(&item.path)));
                    v2.write()
                } else {
                    Self::default()
                }
            }
            Err(err) => {
                println!("err: {:?}", err);
                Self::default()
            }
        }
    }

    pub fn write(self) -> Self {
        let path = &Self::get_path();
        if let Ok(v) = serde_json::to_string_pretty(&self) {
            std::fs::write(path, v).unwrap_or_else(|err| {
                println!("err: {:?}", err);
                Self::default().write();
            });
        } else {
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
    use super::{OpenedCache, WorkspaceInfo};
    use tauri::command;

    #[command]
    pub fn get_opened_cache() -> OpenedCache {
        OpenedCache::read()
    }

    #[command]
    pub fn add_recent_workspace(workspace: WorkspaceInfo) -> OpenedCache {
        OpenedCache::read().add_recent_workspace(workspace)
    }

    #[command]
    pub fn clear_recent_workspaces() -> OpenedCache {
        OpenedCache::read().clear_recent_workspaces()
    }
}
