use super::conf;
use crate::fc::{create_file, exists};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, path::PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KeybindingInfo {
    id: String,
    desc: String,
    key_map: Vec<String>,
}

impl KeybindingInfo {
    pub fn new(id: String, desc: String, key_map: Vec<String>) -> Self {
        Self { id, desc, key_map }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Keybindings {
    cmds: HashMap<String, KeybindingInfo>,
}

impl Keybindings {
    pub fn new() -> Self {
        let map: HashMap<String, KeybindingInfo> = vec![
            (
                "app:open_folder".to_string(),
                KeybindingInfo::new(
                    "app:open_folder".to_string(),
                    "open folder".to_string(),
                    vec![
                        "CommandOrCtrl".to_string(),
                        "Shift".to_string(),
                        "o".to_string(),
                    ],
                ),
            ),
            (
                "app:toggle_sidebar".to_string(),
                KeybindingInfo::new(
                    "app:toggle_sidebar".to_string(),
                    "toggle sideBar visible".to_string(),
                    vec![
                        "CommandOrCtrl".to_string(),
                        "`".to_string(),
                    ],
                ),
            ),
            (
                "editor:save".to_string(),
                KeybindingInfo::new(
                    "editor:save".to_string(),
                    "Save current active edit file".to_string(),
                    vec!["CommandOrCtrl".to_string(), "s".to_string()],
                ),
            ),
            (
                "editor:find_replace".to_string(),
                KeybindingInfo::new(
                    "editor:find_replace".to_string(),
                    "Find current active edit file".to_string(),
                    vec!["CommandOrCtrl".to_string(), "f".to_string()],
                ),
            ),
            (
                "editor:copy".to_string(),
                KeybindingInfo::new(
                    "editor:copy".to_string(),
                    "copy selected text".to_string(),
                    vec!["CommandOrCtrl".to_string(), "c".to_string()],
                ),
            ),
            (
                "editor:cut".to_string(),
                KeybindingInfo::new(
                    "editor:cut".to_string(),
                    "cut selected text".to_string(),
                    vec!["CommandOrCtrl".to_string(), "x".to_string()],
                ),
            ),
            (
                "editor:redo".to_string(),
                KeybindingInfo::new(
                    "editor:redo".to_string(),
                    "redo".to_string(),
                    vec![
                        "CommandOrCtrl".to_string(),
                        "Shift".to_string(),
                        "z".to_string(),
                    ],
                ),
            ),
            (
                "editor:undo".to_string(),
                KeybindingInfo::new(
                    "editor:undo".to_string(),
                    "undo".to_string(),
                    vec!["CommandOrCtrl".to_string(), "z".to_string()],
                ),
            ),
            (
                "editor:paste".to_string(),
                KeybindingInfo::new(
                    "editor:paste".to_string(),
                    "paste pasteboard content".to_string(),
                    vec!["CommandOrCtrl".to_string(), "v".to_string()],
                ),
            ),
            (
                "editor:toggle_bold".to_string(),
                KeybindingInfo::new(
                    "editor:toggle_bold".to_string(),
                    "toggle to bold mark".to_string(),
                    vec!["CommandOrCtrl".to_string(), "b".to_string()],
                ),
            ),
            (
                "editor:toggle_emphasis".to_string(),
                KeybindingInfo::new(
                    "editor:toggle_emphasis".to_string(),
                    "toggle to emphasis mark".to_string(),
                    vec!["CommandOrCtrl".to_string(), "i".to_string()],
                ),
            ),
            (
                "editor:toggle_codetext".to_string(),
                KeybindingInfo::new(
                    "editor:toggle_codetext".to_string(),
                    "toggle to code text".to_string(),
                    vec!["CommandOrCtrl".to_string(), "e".to_string()],
                ),
            ),
            (
                "editor:toggle_delete_inline".to_string(),
                KeybindingInfo::new(
                    "editor:toggle_delete_inline".to_string(),
                    "toggle to delete mark".to_string(),
                    vec!["CommandOrCtrl".to_string(), "Shift".to_string(), "s".to_string()],
                ),
            ),
            (
                "editor:toggle_heading".to_string(),
                KeybindingInfo::new(
                    "editor:toggle_heading".to_string(),
                    "toggle to  h[1-6]".to_string(),
                    vec!["CommandOrCtrl".to_string(), "1-6".to_string()],
                ),
            ),
        ]
        .into_iter()
        .collect();

        Self { cmds: map }
    }

    pub fn amend_cmds(mut self, id: String, new_cmd: KeybindingInfo) -> Self {
        self.cmds.insert(id, new_cmd);
        self.write()
    }

    pub fn get_path() -> PathBuf {
        conf::app_root().join("keybord_map.json")
    }

    pub fn read() -> Self {
        match std::fs::read_to_string(Self::get_path()) {
            Ok(v) => {
                if let Ok(v2) = serde_json::from_str::<Keybindings>(&v) {
                    v2
                } else {
                    Self::default()
                }
            }
            Err(_err) => Self::default(),
        }
    }

    pub fn write(self) -> Self {
        let path = &Self::get_path();
        if !exists(path) {
            create_file(path).unwrap();
        }
        if let Ok(v) = serde_json::to_string_pretty(&self) {
            std::fs::write(path, v).unwrap_or_else(|_err| {
                Self::default().write();
            });
        } else {
        }
        self
    }

    pub fn get_accelerator(self, id: String) -> Option<String> {
        if let Some(v) = self.cmds.get(&id) {
            let v2 = v.key_map.join(" + ");
            if v2.len() > 0 {
                return Some(v2);
            }
        }
        None
    }

    pub fn reset_keybinding(self) -> Self {
        let keyboard_infos = Self::new();
        let path = &Self::get_path();
        if let Ok(v) = serde_json::to_string_pretty(&keyboard_infos) {
            std::fs::write(path, v).unwrap_or_else(|_err| {
                Self::default().write();
            });
        } else {
        }
        self
    }
}

impl Default for Keybindings {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::{KeybindingInfo, Keybindings};
    use tauri::command;

    #[command]
    pub fn get_keyboard_infos() -> Keybindings {
        Keybindings::read().reset_keybinding()
    }

    #[command]
    pub fn amend_cmd(id: String, new_cmd: KeybindingInfo) -> Keybindings {
        Keybindings::read().amend_cmds(id, new_cmd)
    }
}
