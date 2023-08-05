use super::conf;
use crate::fc::{create_file, exists};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
struct KeyboardInfo {
    id: String,
    desc: String,
    key_map: Vec<String>,
}

impl KeyboardInfo {
    pub fn new(id: String, desc: String, key_map: Vec<String>) -> Self {
        Self { id, desc, key_map }
    }
}

#[derive(Serialize, Deserialize)]
pub struct KeyboardInfos {
    cmds: Vec<KeyboardInfo>,
}

impl KeyboardInfos {
    pub fn new() -> Self {
        let key_map: Vec<String> = Vec::new();
        Self {
            cmds: vec![
                KeyboardInfo::new(
                    "app:dialog_about".to_string(),
                    "获取应用信息".to_string(),
                    Vec::new(),
                ),
                KeyboardInfo::new(
                    "app:window_setting".to_string(),
                    "打开设置窗口".to_string(),
                    Vec::new(),
                ),
                KeyboardInfo::new(
                    "app:open_folder".to_string(),
                    "打开文件夹".to_string(),
                    vec!["mod".to_string(), "Shift".to_string(), "o".to_string()],
                )
            ],
        }
    }

    pub fn get_path() -> PathBuf {
        conf::app_root().join("keybord_map.json")
    }

    pub fn read() -> Self {
        match std::fs::read_to_string(Self::get_path()) {
            Ok(v) => {
                if let Ok(v2) = serde_json::from_str::<KeyboardInfos>(&v) {
                    v2
                } else {
                    Self::default()
                }
            }
            Err(err) => Self::default(),
        }
    }

    pub fn write(self) -> Self {
        let path = &Self::get_path();
        if !exists(path) {
            create_file(path).unwrap();
        }
        if let Ok(v) = serde_json::to_string_pretty(&self) {
            std::fs::write(path, v).unwrap_or_else(|err| {
                Self::default().write();
            });
        } else {
        }
        self
    }
}

impl Default for KeyboardInfos {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::KeyboardInfos;
    use tauri::{command, AppHandle};

    #[command]
    pub fn get_keyboard_infos() -> KeyboardInfos {
        KeyboardInfos::read()
    }
}
