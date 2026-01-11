use super::conf;
use crate::fc::{create_file, exists};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KeybindingInfo {
    id: String,
    key_map: Vec<String>,
    when: String,
}

impl KeybindingInfo {
    pub fn new(id: String, key_map: Vec<String>, when: String) -> Self {
        Self { id, key_map, when }
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
                "disabled".to_string(),
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
        let default_key_bindings = Self::default();
        
        if !Self::get_path().exists() {
            return default_key_bindings.write();
        }
        
        match std::fs::read_to_string(Self::get_path()) {
            Ok(v) => {
                if let Ok(user_keybindings) = serde_json::from_str::<Keybindings>(&v) {
                    // 创建一个新的keybindings，基于默认配置
                    let mut merged_keybindings = default_key_bindings.clone();
                    
                    // 只合并用户自定义的快捷键配置
                    for user_cmd in user_keybindings.cmds {
                        if let Some(default_cmd) = merged_keybindings.cmds.iter_mut().find(|cmd| cmd.id == user_cmd.id) {
                            // 只更新key_map，保持其他字段（如when）使用默认值
                            default_cmd.key_map = user_cmd.key_map;
                        }
                    }
                    
                    merged_keybindings
                } else {
                    default_key_bindings
                }
            }
            Err(_err) => default_key_bindings,
        }
    }

    pub fn write(self) -> Self {
        let path = &Self::get_path();
        if !exists(path) {
            create_file(path);
        }

        // 获取默认配置，用于过滤
        let default_keybindings = Self::default();
        
        // 只保存与默认配置不同的快捷键
        let user_defined_cmds: Vec<KeybindingInfo> = self.cmds
            .iter()
            .filter_map(|cmd| {
                if let Some(default_cmd) = default_keybindings.cmds.iter().find(|d| d.id == cmd.id) {
                    // 只保存key_map不同的配置
                    if cmd.key_map != default_cmd.key_map {
                        Some(KeybindingInfo {
                            id: cmd.id.clone(),
                            key_map: cmd.key_map.clone(),
                            when: cmd.when.clone(), // 保持当前配置，虽然理论上应该与默认相同
                        })
                    } else {
                        None // 与默认配置相同，不保存
                    }
                } else {
                    // 如果找不到对应的默认配置，也保存（安全起见）
                    Some(cmd.clone())
                }
            })
            .collect();

        let user_keybindings = Keybindings { cmds: user_defined_cmds };

        if let Ok(v) = serde_json::to_string_pretty(&user_keybindings) {
            std::fs::write(path, v).unwrap_or_else(|_err| {
                Self::default().write();
            });
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
    use super::Keybindings;
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
