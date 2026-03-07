use super::conf;
use crate::fc::exists;
use serde::{Deserialize, Serialize};
use std::{fs::create_dir, path::PathBuf, vec};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Theme {
    pub id: String,
    pub path: String,
    pub pkg: String,
    pub script_text: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct LocalTheme {
    pub id: String,
    pub name: String,
    pub path: String,
    pub css_content: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppThemes {
    themes: Vec<Theme>,
    local_themes: Vec<LocalTheme>,
}
pub const APP_THEMES_PATH: &str = "themes";
pub const APP_LOCAL_THEMES_PATH: &str = "local_themes";

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
        Self { themes: vec![], local_themes: vec![] }
    }

    pub fn dir_path() -> PathBuf {
        conf::app_root().join(APP_THEMES_PATH)
    }

    pub fn local_themes_dir_path() -> PathBuf {
        conf::app_root().join(APP_LOCAL_THEMES_PATH)
    }

    fn build_local_theme(path: &PathBuf) -> Option<LocalTheme> {
        if path.extension().map(|e| e.to_str().unwrap()) == Some("css") {
            let file_name = path.file_stem()?.to_str().unwrap().to_string();
            let css_content = std::fs::read_to_string(path).ok()?;
            return Some(LocalTheme {
                id: file_name.clone(),
                name: file_name,
                path: path.to_str().unwrap().to_string(),
                css_content,
            });
        }
        None
    }

    pub async fn init(mut self) -> Self {
        if !exists(&Self::dir_path()) {
            create_dir(&Self::dir_path());
        }

        if !exists(&Self::local_themes_dir_path()) {
            create_dir(&Self::local_themes_dir_path());
        }

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

        let mut local_themes = vec![];
        let local_dir = Self::local_themes_dir_path();

        if exists(&local_dir) {
            for entry in std::fs::read_dir(local_dir).unwrap() {
                let entry = entry.unwrap();
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                if let Some(local_theme) = Self::build_local_theme(&path) {
                    local_themes.push(local_theme);
                }
            }
        }

        self.themes = themes;
        self.local_themes = local_themes;

        self
    }
}

impl Default for AppThemes {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::{AppThemes, LocalTheme, Theme};
    use crate::fc::exists;
    use tauri::command;
    use std::fs::create_dir;
    use std::path::PathBuf;
    use download_npm;

    #[command]
    pub async fn load_themes() -> Vec<Theme> {
        AppThemes::default().init().await.themes
    }

    #[command]
    pub async fn load_local_themes() -> Vec<LocalTheme> {
        AppThemes::default().init().await.local_themes
    }

    #[command]
    pub async fn import_local_theme(file_path: String) -> Result<LocalTheme, String> {
        let source_path = PathBuf::from(&file_path);
        
        if !source_path.exists() {
            return Err("File does not exist".to_string());
        }

        if source_path.extension().map(|e| e.to_str().unwrap()) != Some("css") {
            return Err("Only CSS files are supported".to_string());
        }

        let file_name = source_path.file_stem()
            .ok_or("Invalid file name")?
            .to_str()
            .ok_or("Invalid file name encoding")?
            .to_string();

        let dest_dir = AppThemes::local_themes_dir_path();
        
        if !exists(&dest_dir) {
            create_dir(&dest_dir);
        }

        let dest_path = dest_dir.join(format!("{}.css", file_name));

        std::fs::copy(&source_path, &dest_path).map_err(|e| {
            format!("Failed to copy file: {}", e)
        })?;

        let css_content = std::fs::read_to_string(&dest_path).map_err(|e| {
            format!("Failed to read file: {}", e)
        })?;

        Ok(LocalTheme {
            id: file_name.clone(),
            name: file_name,
            path: dest_path.to_str().unwrap().to_string(),
            css_content,
        })
    }

    #[command]
    pub async fn remove_local_theme(id: String) -> Result<(), String> {
        let local_themes = AppThemes::default().init().await.local_themes;
        
        let theme = local_themes.iter().find(|t| t.id == id);
        
        if let Some(theme) = theme {
            let path = PathBuf::from(&theme.path);
            if path.exists() {
                std::fs::remove_file(&path).map_err(|e| {
                    format!("Failed to remove file: {}", e)
                })?;
            }
        }

        Ok(())
    }

    #[command]
    pub async fn download_theme(name: String) -> Result<(), String> {
        let dir_path = AppThemes::dir_path();
        // Handle invalid path encoding to prevent runtime panics and provide debug context
        let dest_path = dir_path.to_str().ok_or_else(|| {
            let err_msg = format!("Invalid theme directory path: {:?}", dir_path);
            tracing::error!("{}", err_msg);
            err_msg
        })?.to_string();

        download_npm::download(
            &name,
            download_npm::DownloadOptions {
                untar: true,
                dest_path,
            },
        )
        .await
        .map_err(|e| {
            // Log the detailed error for debugging purposes while returning a user-friendly message
            let err_msg = format!("Failed to download theme '{}': {}", name, e);
            tracing::error!("{}", err_msg);
            err_msg
        })?;

        Ok(())
    }

    #[command]
    pub async fn remove_theme(name: String) -> Result<(), String> {
        let dir_path = AppThemes::dir_path();
        let theme_path = dir_path.join(&name);

        if !theme_path.exists() {
            return Err(format!("Theme '{}' not found", name));
        }

        std::fs::remove_dir_all(&theme_path).map_err(|e| {
            let err_msg = format!("Failed to remove theme '{}': {}", name, e);
            tracing::error!("{}", err_msg);
            err_msg
        })?;

        Ok(())
    }
}
