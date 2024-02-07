use super::conf;
use crate::fc::exists;
use serde::{Deserialize, Serialize};
use std::{fs::create_dir, path::PathBuf, vec};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Theme {
    pub id: String,
    pub path: String,
    // package.json content
    pub pkg: String,
    pub script_text: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppThemes {
    themes: Vec<Theme>,
}
pub const APP_THEMES_PATH: &str = "themes";

fn build_theme(path: PathBuf) -> Option<Theme> {
    println!("build_themes: {:?}", path);
    let pkg_path = path.join("package.json");
    let script_file_path = path.join("index.js");

    if exists(&pkg_path) {
        let pkg = std::fs::read_to_string(pkg_path).unwrap();
        let pkg: serde_json::Value = serde_json::from_str(&pkg).unwrap();
        let pkg = pkg.to_string();

        let script_text = if exists(&script_file_path) {
            Some(std::fs::read_to_string(script_file_path).unwrap())
        } else {
            None
        };

        return Some(Theme {
            id: path.file_name().unwrap().to_str().unwrap().to_string(),
            path: path.to_str().unwrap().to_string(),
            pkg,
            script_text,
        });
    }

    None
}

impl AppThemes {
    pub fn new() -> Self {
        Self { themes: vec![] }
    }

    pub fn dir_path() -> PathBuf {
        conf::app_root().join(APP_THEMES_PATH)
    }

    pub async fn init(mut self) -> Self {
        if !exists(&Self::dir_path()) {
            create_dir(&Self::dir_path());
        }

        // load themes
        let mut themes = vec![];
        let dir = Self::dir_path();

        for entry in std::fs::read_dir(dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let theme = build_theme(path);

            if theme.is_none() {
                continue;
            }
            themes.push(theme.unwrap());
        }

        self.themes = themes;

        self
    }
}

impl Default for AppThemes {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::{AppThemes, Theme};
    use tauri::command;

    #[command]
    pub async fn load_themes() -> Vec<Theme> {
        AppThemes::default().init().await.themes
    }
}
