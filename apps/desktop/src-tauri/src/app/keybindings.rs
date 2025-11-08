use super::conf;
use crate::fc::{create_file, exists};
use serde::{Deserialize, Serialize};
use std::{path::PathBuf};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KeybindingInfo {
    id: String,
    key_map: Vec<String>,
    when: String
}

impl KeybindingInfo {
    pub fn new(id: String, key_map: Vec<String>, when: String) -> Self {
        Self {
            id,
            key_map,
            when
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Keybindings {
    cmds: Vec<KeybindingInfo>,
}

impl Keybindings {
    pub fn new() -> Self {
        let cmds = vec![
            KeybindingInfo::new(
                "app_openFolder".to_string(),
                vec![
                    "CommandOrCtrl".to_string(),
                    "Shift".to_string(),
                    "o".to_string(),
                ],
                "always".to_string(),
            ),
            KeybindingInfo::new(
                "app_toggleLeftsidebarVisible".to_string(),
                vec!["CommandOrCtrl".to_string(), "l".to_string()],
                "always".to_string(),
            ),
            KeybindingInfo::new(
                "app_toggleRightsidebarVisible".to_string(),
                vec!["CommandOrCtrl".to_string(), "r".to_string()],
                "always".to_string(),
            ),
            KeybindingInfo::new(
                "app_save".to_string(),
                vec!["CommandOrCtrl".to_string(), "s".to_string()],
                "always".to_string(),
            ),
            KeybindingInfo::new(
                "app_findReplaceEditor".to_string(),
                vec!["CommandOrCtrl".to_string(), "f".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "app_closeCurrentEditorTab".to_string(),
                vec!["CommandOrCtrl".to_string(), "w".to_string()],
                "always".to_string(),
            ),
            KeybindingInfo::new(
                "app_hide".to_string(),
                vec!["CommandOrCtrl".to_string(), "h".to_string()],
                "always".to_string(),
            ),
            KeybindingInfo::new(
                "app_openSetting".to_string(),
                vec!["CommandOrCtrl".to_string(), ",".to_string()],
                "always".to_string(),
            ),
            KeybindingInfo::new(
                "editor_copy".to_string(),
                vec!["CommandOrCtrl".to_string(), "c".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_cut".to_string(),
                vec!["CommandOrCtrl".to_string(), "x".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_redo".to_string(),
                vec![
                    "CommandOrCtrl".to_string(),
                    "Shift".to_string(),
                    "z".to_string(),
                ],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_undo".to_string(),
                vec!["CommandOrCtrl".to_string(), "z".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_paste".to_string(),
                vec!["CommandOrCtrl".to_string(), "v".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleStrong".to_string(),
                vec!["CommandOrCtrl".to_string(), "b".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleEmphasis".to_string(),
                vec!["CommandOrCtrl".to_string(), "i".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleCodeText".to_string(),
                vec!["CommandOrCtrl".to_string(), "e".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleDelete".to_string(),
                vec![
                    "CommandOrCtrl".to_string(),
                    "Shift".to_string(),
                    "s".to_string(),
                ],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleH1".to_string(),
                vec!["CommandOrCtrl".to_string(), "1".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleH2".to_string(),
                vec!["CommandOrCtrl".to_string(), "2".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleH3".to_string(),
                vec!["CommandOrCtrl".to_string(), "3".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleH4".to_string(),
                vec!["CommandOrCtrl".to_string(), "4".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleH5".to_string(),
                vec!["CommandOrCtrl".to_string(), "5".to_string()],
                "editor_focus".to_string(),
            ),
            KeybindingInfo::new(
                "editor_toggleH6".to_string(),
                vec!["CommandOrCtrl".to_string(), "6".to_string()],
                "editor_focus".to_string(),
            ),
        ];

        Self { cmds }
    }

    pub fn update_keybinding(mut self, id: String, new_key_map: Vec<String>) -> bool {
        if let Some(cmd) = self.cmds.iter_mut().find(|cmd| cmd.id == id) {
            cmd.key_map = new_key_map;
            self.write();
            return true;
        }
        return false;
    }

    pub fn get_path() -> PathBuf {
        conf::app_root().join("keybord_map_v1.json")
    }

    pub fn read() -> Self {

        if !Self::get_path().exists() {
            return Self::default().write();
        }
        match std::fs::read_to_string(Self::get_path()) {
            Ok(v) => {
                if let Ok(mut v2) = serde_json::from_str::<Keybindings>(&v) {
                    let default_key_bindings = Self::default();
                    let mut is_diff = false;

                    for default_cmd in default_key_bindings.cmds {
                        if !v2.cmds.iter().any(|cmd| cmd.id == default_cmd.id) {
                            v2.cmds.push(default_cmd);
                            is_diff = true;
                        }
                    }

                    if is_diff {
                        v2 = v2.clone().write();
                    }
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
            create_file(path);
        }
        
        let mut sorted_cmds = self.cmds.clone();
        sorted_cmds.sort_by(|a, b| {
            let a_is_app = a.id.starts_with("app:");
            let b_is_app = b.id.starts_with("app:");
            
            if a_is_app && !b_is_app {
                return std::cmp::Ordering::Less;
            } else if !a_is_app && b_is_app {
                return std::cmp::Ordering::Greater;
            }
            
            a.id.cmp(&b.id)
        });
        
        let ordered_keybindings = Keybindings { cmds: sorted_cmds };
        
        if let Ok(v) = serde_json::to_string_pretty(&ordered_keybindings) {
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
    use super::{Keybindings};
    use tauri::command;

    #[command]
    pub fn get_keyboard_infos() -> Keybindings {
        Keybindings::read()
    }

    #[command]
    pub fn update_keybinding(id: String, new_key_map: Vec<String>) -> bool {
        Keybindings::read().update_keybinding(id, new_key_map)
    }
}
