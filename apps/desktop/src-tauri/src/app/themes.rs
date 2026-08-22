use super::conf;
use super::startup_io;
use crate::fc::exists;
use serde::{Deserialize, Serialize};
use std::{
    fs::create_dir_all,
    path::PathBuf,
    sync::{
        atomic::{AtomicU64, Ordering},
        RwLock,
    },
    time::Instant,
    vec,
};

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
#[serde(rename_all = "camelCase")]
pub struct AppThemes {
    themes: Vec<Theme>,
    local_themes: Vec<LocalTheme>,
}
pub const APP_THEMES_PATH: &str = "themes";
pub const APP_LOCAL_THEMES_PATH: &str = "local_themes";
static THEME_CATALOG_CACHE: RwLock<Option<(u64, AppThemes)>> = RwLock::new(None);
static THEME_CATALOG_GENERATION: AtomicU64 = AtomicU64::new(0);
lazy_static::lazy_static! {
    static ref THEME_CATALOG_LOAD_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::new(());
}

fn build_theme(path: PathBuf) -> Option<Theme> {
    let pkg_path = path.join("package.json");
    let script_file_path = path.join("index.js");

    if exists(&pkg_path) {
        let pkg = std::fs::read_to_string(pkg_path).ok()?;
        let pkg: serde_json::Value = serde_json::from_str(&pkg).ok()?;
        let pkg = pkg.to_string();

        let script_text = if exists(&script_file_path) {
            std::fs::read_to_string(script_file_path).ok()
        } else {
            None
        };

        return Some(Theme {
            id: path.file_name()?.to_str()?.to_string(),
            path: path.to_str()?.to_string(),
            pkg,
            script_text,
        });
    }

    None
}

impl AppThemes {
    pub fn new() -> Self {
        Self {
            themes: vec![],
            local_themes: vec![],
        }
    }

    pub fn dir_path() -> PathBuf {
        conf::app_root().join(APP_THEMES_PATH)
    }

    pub fn local_themes_dir_path() -> PathBuf {
        conf::app_root().join(APP_LOCAL_THEMES_PATH)
    }

    fn build_local_theme(path: &PathBuf) -> Option<LocalTheme> {
        if path.extension().and_then(|extension| extension.to_str()) == Some("css") {
            let file_name = path.file_stem()?.to_str()?.to_string();
            let css_content = std::fs::read_to_string(path).ok()?;
            return Some(LocalTheme {
                id: file_name.clone(),
                name: file_name,
                path: path.to_str()?.to_string(),
                css_content,
            });
        }
        None
    }

    pub fn init(mut self) -> Result<Self, String> {
        create_dir_all(Self::dir_path())
            .map_err(|error| format!("Failed to create theme directory: {error}"))?;
        create_dir_all(Self::local_themes_dir_path())
            .map_err(|error| format!("Failed to create local theme directory: {error}"))?;

        let mut themes = vec![];
        let dir = Self::dir_path();

        for entry in std::fs::read_dir(dir)
            .map_err(|error| format!("Failed to read theme directory: {error}"))?
        {
            let entry = match entry {
                Ok(entry) => entry,
                Err(error) => {
                    tracing::warn!("Failed to read theme directory entry: {error}");
                    continue;
                }
            };
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
            for entry in std::fs::read_dir(local_dir)
                .map_err(|error| format!("Failed to read local theme directory: {error}"))?
            {
                let entry = match entry {
                    Ok(entry) => entry,
                    Err(error) => {
                        tracing::warn!("Failed to read local theme directory entry: {error}");
                        continue;
                    }
                };
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

        Ok(self)
    }
}

fn cached_theme_catalog() -> Option<AppThemes> {
    let generation = THEME_CATALOG_GENERATION.load(Ordering::Acquire);
    THEME_CATALOG_CACHE
        .read()
        .unwrap_or_else(|error| error.into_inner())
        .as_ref()
        .filter(|(cached_generation, _)| *cached_generation == generation)
        .map(|(_, catalog)| catalog.clone())
}

fn cache_theme_catalog(catalog: AppThemes, generation: u64) -> Option<AppThemes> {
    let mut cache = THEME_CATALOG_CACHE
        .write()
        .unwrap_or_else(|error| error.into_inner());
    if generation != THEME_CATALOG_GENERATION.load(Ordering::Acquire) {
        return None;
    }
    if let Some((cached_generation, existing)) = cache.as_ref() {
        if *cached_generation == generation {
            return Some(existing.clone());
        }
    }
    *cache = Some((generation, catalog.clone()));
    Some(catalog)
}

fn invalidate_theme_catalog() {
    THEME_CATALOG_GENERATION.fetch_add(1, Ordering::AcqRel);
    *THEME_CATALOG_CACHE
        .write()
        .unwrap_or_else(|error| error.into_inner()) = None;
}

async fn load_theme_catalog_cached() -> Result<AppThemes, String> {
    let started_at = Instant::now();
    if let Some(catalog) = cached_theme_catalog() {
        tracing::debug!(
            marker = "theme-catalog-loaded",
            cached = true,
            elapsed_ms = started_at.elapsed().as_millis() as u64,
            theme_count = catalog.themes.len(),
            local_theme_count = catalog.local_themes.len(),
            "Theme catalog loaded"
        );
        return Ok(catalog);
    }

    let _load_guard = THEME_CATALOG_LOAD_LOCK.lock().await;
    loop {
        if let Some(catalog) = cached_theme_catalog() {
            return Ok(catalog);
        }

        let generation = THEME_CATALOG_GENERATION.load(Ordering::Acquire);
        let catalog = startup_io::run(|| AppThemes::default().init())
            .await
            .map_err(|error| format!("Failed to join theme catalog reader: {error}"))??;

        // A completed import/download/remove invalidates the generation. Scan
        // again instead of publishing a catalog captured before that mutation.
        if generation != THEME_CATALOG_GENERATION.load(Ordering::Acquire) {
            continue;
        }

        if let Some(catalog) = cache_theme_catalog(catalog, generation) {
            tracing::debug!(
                marker = "theme-catalog-loaded",
                cached = false,
                elapsed_ms = started_at.elapsed().as_millis() as u64,
                theme_count = catalog.themes.len(),
                local_theme_count = catalog.local_themes.len(),
                "Theme catalog loaded"
            );
            return Ok(catalog);
        }
    }
}

impl Default for AppThemes {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::{
        invalidate_theme_catalog, load_theme_catalog_cached, AppThemes, LocalTheme, Theme,
    };
    use crate::fc::exists;
    use download_npm;
    use std::fs::create_dir_all;
    use std::path::PathBuf;
    use tauri::command;

    #[command]
    pub async fn load_theme_catalog() -> Result<AppThemes, String> {
        load_theme_catalog_cached().await
    }

    #[command]
    pub async fn load_themes() -> Result<Vec<Theme>, String> {
        Ok(load_theme_catalog_cached().await?.themes)
    }

    #[command]
    pub async fn load_local_themes() -> Result<Vec<LocalTheme>, String> {
        Ok(load_theme_catalog_cached().await?.local_themes)
    }

    #[command]
    pub async fn import_local_theme(file_path: String) -> Result<LocalTheme, String> {
        let source_path = PathBuf::from(&file_path);

        if !source_path.exists() {
            return Err("File does not exist".to_string());
        }

        if source_path
            .extension()
            .and_then(|extension| extension.to_str())
            != Some("css")
        {
            return Err("Only CSS files are supported".to_string());
        }

        let file_name = source_path
            .file_stem()
            .ok_or("Invalid file name")?
            .to_str()
            .ok_or("Invalid file name encoding")?
            .to_string();

        let dest_dir = AppThemes::local_themes_dir_path();

        if !exists(&dest_dir) {
            create_dir_all(&dest_dir)
                .map_err(|error| format!("Failed to create local theme directory: {error}"))?;
        }

        let dest_path = dest_dir.join(format!("{}.css", file_name));

        std::fs::copy(&source_path, &dest_path)
            .map_err(|e| format!("Failed to copy file: {}", e))?;

        let css_content = std::fs::read_to_string(&dest_path)
            .map_err(|e| format!("Failed to read file: {}", e))?;

        let theme = LocalTheme {
            id: file_name.clone(),
            name: file_name,
            path: dest_path.to_string_lossy().to_string(),
            css_content,
        };
        invalidate_theme_catalog();
        Ok(theme)
    }

    #[command]
    pub async fn remove_local_theme(id: String) -> Result<(), String> {
        let local_themes = load_theme_catalog_cached().await?.local_themes;

        let theme = local_themes.iter().find(|t| t.id == id);

        if let Some(theme) = theme {
            let path = PathBuf::from(&theme.path);
            if path.exists() {
                std::fs::remove_file(&path).map_err(|e| format!("Failed to remove file: {}", e))?;
                invalidate_theme_catalog();
            }
        }

        Ok(())
    }

    #[command]
    pub async fn download_theme(name: String) -> Result<(), String> {
        let dir_path = AppThemes::dir_path();
        // Handle invalid path encoding to prevent runtime panics and provide debug context
        let dest_path = dir_path
            .to_str()
            .ok_or_else(|| {
                let err_msg = format!("Invalid theme directory path: {:?}", dir_path);
                tracing::error!("{}", err_msg);
                err_msg
            })?
            .to_string();

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

        invalidate_theme_catalog();
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

        invalidate_theme_catalog();
        Ok(())
    }
}
