use super::conf;
use crate::fc::{create_file, exists};
use download_npm;
use serde::{Deserialize, Serialize};
use std::{
    fs::create_dir,
    path::{self, PathBuf},
    vec,
};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Extension {
    pub id: String,
    pub path: String,
    // package.json content
    pub pkg: String,
    pub script_text: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppExtensions {
    extensions: Vec<Extension>,
}
pub const APP_EXTENSIONS_PATH: &str = "extensions";

fn build_extension(path: PathBuf) -> Option<Extension> {
    println!("build_extension: {:?}", path);
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

        return Some(Extension {
            id: path.file_name().unwrap().to_str().unwrap().to_string(),
            path: path.to_str().unwrap().to_string(),
            pkg,
            script_text
        });
    }

    None
}

impl AppExtensions {
    pub fn new() -> Self {
        Self { extensions: vec![] }
    }

    pub fn dir_path() -> PathBuf {
        conf::app_root().join(APP_EXTENSIONS_PATH)
    }

    pub async fn init(mut self) -> Self {
        if !exists(&Self::dir_path()) {
            create_dir(&Self::dir_path());
        }

        // let _ = &Self::downloadBuiltInExtensions(self.clone()).await;

        // load extensions
        let mut extensions = vec![];
        let dir = Self::dir_path();

        for entry in std::fs::read_dir(dir).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let extension = build_extension(path);
            // 如果 extension 为 None 则跳过
            if extension.is_none() {
                continue;
            }
            extensions.push(extension.unwrap());
        }

        self.extensions = extensions;

        self
    }

    pub async fn downloadBuiltInExtensions(self) -> Self {
        if exists(&Self::dir_path().join("markflowy-theme-template")) {
            return self;
        }

       let _ = download_npm::download(
            "markflowy-theme-template",
            download_npm::DownloadOptions {
                untar: true,
                dest_path: Self::dir_path().to_str().unwrap().to_string(),
            },
        ).await;

        self
    }
}

impl Default for AppExtensions {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::{AppExtensions, Extension};
    use tauri::command;

    #[command]
    pub async fn extensions_init() -> Vec<Extension> {
        AppExtensions::default().init().await.extensions
    }
}
