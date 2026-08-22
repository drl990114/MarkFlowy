use crate::{fc::exists, APP_DIR};
use etcetera::{choose_app_strategy, AppStrategy, AppStrategyArgs};
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashMap},
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock, RwLock},
    time::Instant,
};
use tauri::{AppHandle, Manager, Theme};
use tauri_plugin_store::{Store, StoreBuilder};

macro_rules! pub_struct {
  ($name:ident {$($field:ident: $t:ty,)*}) => {
    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq)]
    pub struct $name {
      $(pub $field: $t),*
    }
  }
}

macro_rules! merge_options {
    ($self:ident, $old:ident, $($field:ident),+) => {
        $(
            $self.$field = $old.$field.or($self.$field);
        )+
    }
}

pub_struct!(AppConf {
    theme: Option<String>,
    theme_mode: Option<String>,
    theme_accent_color: Option<String>,
    light_theme: Option<String>,
    dark_theme: Option<String>,
    language: Option<String>,
    auto_update: Option<bool>,
    webview_zoom: Option<String>,
    copilot_provider: Option<String>,
    copilot_model: Option<String>,
    copilot_enabled: Option<bool>,
    editor_full_width: Option<bool>,
    editor_typewriter_scroll: Option<bool>,
    editor_placeholder: Option<bool>,
    editor_insert_date_format: Option<String>,
    editor_root_font_size: Option<u32>,
    editor_root_line_height: Option<String>,
    extensions_chatgpt_apibase: Option<String>,
    extensions_chatgpt_apikey: Option<String>,
    extensions_chatgpt_models: Option<String>,
    extensions_chatgpt_request_headers: Option<HashMap<String, String>>,
    extensions_deepseek_apibase: Option<String>,
    extensions_deepseek_apikey: Option<String>,
    extensions_deepseek_models: Option<String>,
    extensions_deepseek_request_headers: Option<HashMap<String, String>>,
    extensions_ollama_apibase: Option<String>,
    extensions_ollama_models: Option<String>,
    extensions_ollama_request_headers: Option<HashMap<String, String>>,
    extensions_google_apibase: Option<String>,
    extensions_google_models: Option<String>,
    extensions_google_apikey: Option<String>,
    extensions_google_request_headers: Option<HashMap<String, String>>,
    autosave: Option<bool>,
    autosave_interval: Option<u32>,
    editor_root_font_family: Option<String>,
    editor_code_font_family: Option<String>,
    wysiwyg_editor_codemirror_line_wrap: Option<bool>,
    wysiwyg_editor_live_preview_block_behavior: Option<String>,
    wysiwyg_editor_spellcheck: Option<bool>,
    source_code_editor_spellcheck: Option<bool>,
    md_editor_default_mode: Option<String>,
    file_exclude_patterns: Option<String>,
    when_paste_image: Option<String>,
    paste_image_save_absolute_path: Option<String>,
    paste_image_save_relative_path: Option<String>,
    paste_image_save_relative_path_rule: Option<String>,
    when_upload_image: Option<String>,
    upload_image_save_absolute_path: Option<String>,
    upload_image_save_relative_path: Option<String>,
    upload_image_save_relative_path_rule: Option<String>,
    dialog_preferences: Option<HashMap<String, String>>,
});

pub const APP_CONF_PATH: &str = "markflowy.conf.json";
pub const APP_FILE_EXCLUDE_PATTERNS_PATH: &str = "markflowy-ignore";
pub const DEFAULT_EXCLUDE_PATTERNS: &str = ".DS_Store\n.git\nThumbs.db\n.svn\n.hg\n";
pub const STORE_KEY: &str = "app_config_v3";
pub const STARTUP_APPEARANCE_PATH: &str = "startup_appearance_v1.json";
pub const STARTUP_APPEARANCE_SCHEMA_VERSION: u32 = 1;

static APP_CONF_CACHE: OnceLock<RwLock<AppConf>> = OnceLock::new();
static STARTUP_APPEARANCE_CACHE: OnceLock<RwLock<Option<StartupAppearance>>> = OnceLock::new();
static CONFIG_STORE_WRITE_LOCK: Mutex<()> = Mutex::new(());
static STARTUP_APPEARANCE_WRITE_LOCK: Mutex<()> = Mutex::new(());
lazy_static::lazy_static! {
    // Tokio's mutex queues waiters in FIFO order. Acquire it before dispatching
    // to the blocking pool so rapid renderer saves cannot complete out of order.
    static ref CONFIG_COMMAND_WRITE_QUEUE: tokio::sync::Mutex<()> = tokio::sync::Mutex::new(());
    static ref STARTUP_APPEARANCE_COMMAND_WRITE_QUEUE: tokio::sync::Mutex<()> = tokio::sync::Mutex::new(());
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ThemePreference {
    Light,
    Dark,
    System,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ResolvedThemeMode {
    Light,
    Dark,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StartupPalette {
    pub surface_app: String,
    pub surface_panel: String,
    pub surface_toolbar: String,
    pub foreground: String,
    pub muted_foreground: String,
    pub border: String,
    pub accent: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct StartupAppearance {
    pub schema_version: u32,
    pub theme_id: String,
    pub preference: ThemePreference,
    pub resolved_mode: ResolvedThemeMode,
    pub palette: StartupPalette,
}

impl ThemePreference {
    fn from_config(value: Option<&str>) -> Self {
        match value {
            Some("dark") => Self::Dark,
            Some("light") => Self::Light,
            _ => Self::System,
        }
    }

    pub fn native_window_theme(self) -> Option<Theme> {
        match self {
            Self::Dark => Some(Theme::Dark),
            Self::Light => Some(Theme::Light),
            Self::System => None,
        }
    }
}

impl StartupPalette {
    fn fallback(mode: ResolvedThemeMode) -> Self {
        match mode {
            ResolvedThemeMode::Dark => Self {
                surface_app: "#131313".into(),
                surface_panel: "#1E1D1E".into(),
                surface_toolbar: "#323232".into(),
                foreground: "#CACCCA".into(),
                muted_foreground: "#9E9E9E".into(),
                border: "#404040".into(),
                accent: "#3794FF".into(),
            },
            ResolvedThemeMode::Light => Self {
                surface_app: "#FFFFFF".into(),
                surface_panel: "#F9F9F9".into(),
                surface_toolbar: "#FEFEFE".into(),
                foreground: "#000000".into(),
                muted_foreground: "#505050".into(),
                border: "#D2D2D2".into(),
                accent: "#1F6AE2".into(),
            },
        }
    }

    fn validate(&self) -> Result<(), String> {
        if !matches!(
            parse_hex_color(&self.surface_app),
            Some(tauri::webview::Color(_, _, _, 255))
        ) {
            return Err("appearance palette surfaceApp must be an opaque safe hex color".into());
        }

        for (name, color) in [
            ("surfacePanel", &self.surface_panel),
            ("surfaceToolbar", &self.surface_toolbar),
            ("foreground", &self.foreground),
            ("mutedForeground", &self.muted_foreground),
            ("border", &self.border),
            ("accent", &self.accent),
        ] {
            if parse_hex_color(color).is_none() {
                return Err(format!(
                    "appearance palette {name} must be a safe hex color"
                ));
            }
        }

        Ok(())
    }

    pub fn surface_color(&self) -> tauri::webview::Color {
        parse_hex_color(&self.surface_app).unwrap_or(tauri::webview::Color(255, 255, 255, 255))
    }
}

impl StartupAppearance {
    fn fallback_from_conf(conf: &AppConf) -> Self {
        let preference = ThemePreference::from_config(conf.theme_mode.as_deref());
        let resolved_mode = match preference {
            ThemePreference::Dark => ResolvedThemeMode::Dark,
            ThemePreference::Light => ResolvedThemeMode::Light,
            ThemePreference::System => match AppConf::system_theme() {
                Theme::Dark => ResolvedThemeMode::Dark,
                _ => ResolvedThemeMode::Light,
            },
        };
        let theme_id = conf.theme_id_for_mode(resolved_mode);

        Self {
            schema_version: STARTUP_APPEARANCE_SCHEMA_VERSION,
            theme_id,
            preference,
            resolved_mode,
            palette: StartupPalette::fallback(resolved_mode),
        }
    }

    pub fn validate(&self) -> Result<(), String> {
        if self.schema_version != STARTUP_APPEARANCE_SCHEMA_VERSION {
            return Err(format!(
                "unsupported startup appearance schema version {}",
                self.schema_version
            ));
        }
        if self.theme_id.trim().is_empty()
            || self.theme_id.trim() != self.theme_id
            || self.theme_id.chars().count() > 128
            || self.theme_id.chars().any(char::is_control)
        {
            return Err("appearance themeId is invalid".to_string());
        }

        self.palette.validate()
    }

    fn resolve_system_mode(mut self, current_mode: ResolvedThemeMode) -> Self {
        if self.preference != ThemePreference::System || self.resolved_mode == current_mode {
            return self;
        }

        self.resolved_mode = current_mode;
        self.theme_id = match current_mode {
            ResolvedThemeMode::Dark => "MarkFlowy Dark",
            ResolvedThemeMode::Light => "MarkFlowy Light",
        }
        .to_string();
        self.palette = StartupPalette::fallback(current_mode);
        self
    }

    fn matches_conf_identity(&self, conf: &AppConf) -> bool {
        let preference = ThemePreference::from_config(conf.theme_mode.as_deref());
        if self.preference != preference {
            return false;
        }

        let resolved_mode = match preference {
            ThemePreference::Dark => ResolvedThemeMode::Dark,
            ThemePreference::Light => ResolvedThemeMode::Light,
            ThemePreference::System => current_resolved_system_mode(),
        };

        let accent_matches = normalized_theme_accent_override(conf)
            .map(|accent| self.palette.accent.eq_ignore_ascii_case(&accent))
            .unwrap_or(true);

        self.resolved_mode == resolved_mode
            && self.theme_id == conf.theme_id_for_mode(resolved_mode)
            && accent_matches
    }
}

fn normalized_theme_accent_override(conf: &AppConf) -> Option<String> {
    let color = conf.theme_accent_color.as_deref()?.trim();
    if color.eq_ignore_ascii_case("system") {
        return None;
    }
    let color = color.strip_prefix('#')?;
    if !color.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }

    match color.len() {
        3 => {
            let mut expanded = String::with_capacity(7);
            expanded.push('#');
            for part in color.chars() {
                expanded.push(part);
                expanded.push(part);
            }
            Some(expanded.to_ascii_lowercase())
        }
        6 => Some(format!("#{color}").to_ascii_lowercase()),
        _ => None,
    }
}

fn parse_hex_color(value: &str) -> Option<tauri::webview::Color> {
    let value = value.strip_prefix('#')?;
    if !matches!(value.len(), 3 | 4 | 6 | 8) || !value.bytes().all(|byte| byte.is_ascii_hexdigit())
    {
        return None;
    }

    let parse_pair = |start: usize| u8::from_str_radix(&value[start..start + 2], 16).ok();
    let parse_nibble = |index: usize| {
        u8::from_str_radix(&value[index..index + 1], 16)
            .ok()
            .map(|part| part * 17)
    };

    match value.len() {
        3 => Some(tauri::webview::Color(
            parse_nibble(0)?,
            parse_nibble(1)?,
            parse_nibble(2)?,
            255,
        )),
        4 => Some(tauri::webview::Color(
            parse_nibble(0)?,
            parse_nibble(1)?,
            parse_nibble(2)?,
            parse_nibble(3)?,
        )),
        6 => Some(tauri::webview::Color(
            parse_pair(0)?,
            parse_pair(2)?,
            parse_pair(4)?,
            255,
        )),
        8 => Some(tauri::webview::Color(
            parse_pair(0)?,
            parse_pair(2)?,
            parse_pair(4)?,
            parse_pair(6)?,
        )),
        _ => None,
    }
}

fn create_store(app: &AppHandle) -> Result<std::sync::Arc<Store<tauri::Wry>>, String> {
    let store_path = "markflowy_store.bin";

    StoreBuilder::new(app.app_handle(), store_path)
        .build()
        .map_err(|e| format!("Failed to build store: {:?}", e))
}

fn save_store_value(store: &Store<tauri::Wry>, key: &str, value: Value) -> Result<bool, String> {
    let previous = store.get(key);
    if previous.as_ref() == Some(&value) {
        return Ok(false);
    }

    store.set(key.to_string(), value);
    if let Err(error) = store.save() {
        // StoreBuilder returns a shared in-process store for a path. Restore its
        // cache so a later successful write cannot accidentally flush a value
        // whose command already reported failure.
        if let Some(previous) = previous {
            store.set(key.to_string(), previous);
        } else {
            store.delete(key);
        }
        return Err(format!("Failed to save store value {key}: {error:?}"));
    }

    Ok(true)
}

fn startup_appearance_path() -> PathBuf {
    app_root().join(STARTUP_APPEARANCE_PATH)
}

fn read_startup_appearance_file(path: &Path) -> Option<StartupAppearance> {
    let appearance = serde_json::from_slice::<StartupAppearance>(&fs::read(path).ok()?).ok()?;
    appearance.validate().ok().map(|_| appearance)
}

fn write_startup_appearance_file(
    path: &Path,
    appearance: &StartupAppearance,
) -> Result<(), String> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| "Startup appearance path has no parent directory".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Failed to create startup appearance directory: {error}"))?;

    let content = serde_json::to_vec(appearance)
        .map_err(|error| format!("Failed to serialize startup appearance: {error}"))?;
    let mut temp_file = tempfile::Builder::new()
        .prefix(".startup-appearance-")
        .tempfile_in(parent)
        .map_err(|error| format!("Failed to create startup appearance temp file: {error}"))?;
    temp_file
        .write_all(&content)
        .map_err(|error| format!("Failed to write startup appearance temp file: {error}"))?;
    temp_file
        .as_file_mut()
        .sync_all()
        .map_err(|error| format!("Failed to sync startup appearance temp file: {error}"))?;
    temp_file
        .persist(path)
        .map_err(|error| format!("Failed to persist startup appearance: {}", error.error))?;

    #[cfg(unix)]
    fs::File::open(parent)
        .and_then(|directory| directory.sync_all())
        .map_err(|error| format!("Failed to sync startup appearance directory: {error}"))?;

    Ok(())
}

fn startup_appearance_cache() -> &'static RwLock<Option<StartupAppearance>> {
    STARTUP_APPEARANCE_CACHE
        .get_or_init(|| RwLock::new(read_startup_appearance_file(&startup_appearance_path())))
}

fn read_existing_conf_from_store(store: &Store<tauri::Wry>) -> Option<AppConf> {
    serde_json::from_value::<AppConf>(store.get(STORE_KEY)?.clone()).ok()
}

fn startup_appearance_fallback(app: &AppHandle) -> StartupAppearance {
    let store = create_store(app).ok();
    let conf = store
        .as_deref()
        .and_then(read_existing_conf_from_store)
        .map(|conf| AppConf::new().merge_conf(conf))
        .unwrap_or_default();
    StartupAppearance::fallback_from_conf(&conf)
}

fn startup_theme_identity_changed(current: &AppConf, candidate: &AppConf) -> bool {
    current.theme != candidate.theme
        || current.theme_mode != candidate.theme_mode
        || current.theme_accent_color != candidate.theme_accent_color
        || current.light_theme != candidate.light_theme
        || current.dark_theme != candidate.dark_theme
}

fn remove_startup_appearance_file(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Failed to invalidate startup appearance snapshot: {error}"
            ))
        }
    }

    #[cfg(unix)]
    if let Some(parent) = path.parent() {
        fs::File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|error| format!("Failed to sync startup appearance directory: {error}"))?;
    }

    Ok(())
}

fn invalidate_startup_appearance_snapshot() -> Result<(), String> {
    remove_startup_appearance_file(&startup_appearance_path())?;
    *startup_appearance_cache()
        .write()
        .unwrap_or_else(|error| error.into_inner()) = None;
    Ok(())
}

fn persist_startup_appearance_snapshot(appearance: StartupAppearance) -> Result<(), String> {
    let cached_appearance = startup_appearance_cache()
        .read()
        .unwrap_or_else(|error| error.into_inner());
    if !startup_appearance_changed(cached_appearance.as_ref(), &appearance) {
        return Ok(());
    }
    drop(cached_appearance);

    write_startup_appearance_file(&startup_appearance_path(), &appearance)?;
    replace_cached_startup_appearance(appearance);
    Ok(())
}

fn current_resolved_system_mode() -> ResolvedThemeMode {
    match AppConf::system_theme() {
        Theme::Dark => ResolvedThemeMode::Dark,
        _ => ResolvedThemeMode::Light,
    }
}

fn replace_cached_conf(conf: AppConf) {
    if let Some(cache) = APP_CONF_CACHE.get() {
        *cache.write().unwrap_or_else(|error| error.into_inner()) = conf;
    }
}

fn replace_cached_startup_appearance(appearance: StartupAppearance) {
    *startup_appearance_cache()
        .write()
        .unwrap_or_else(|error| error.into_inner()) = Some(appearance);
}

fn startup_appearance_changed(
    current: Option<&StartupAppearance>,
    candidate: &StartupAppearance,
) -> bool {
    current != Some(candidate)
}

pub fn app_root() -> PathBuf {
    let app_dir = APP_DIR.lock().unwrap();
    let base_dir = app_dir.get(&0).unwrap().clone();

    #[cfg(target_os = "macos")]
    {
        return base_dir;
    }

    #[cfg(not(target_os = "macos"))]
    {
        let legacy_path = base_dir.join(".markflowy");

        if exists(&legacy_path) {
            return legacy_path;
        }

        #[cfg(target_os = "windows")]
        {
            legacy_path
        }
        #[cfg(not(target_os = "windows"))]
        {
            match choose_app_strategy(AppStrategyArgs {
                top_level_domain: "com".to_string(),
                author: "drl990114".to_string(),
                app_name: "markflowy".to_string(),
            }) {
                Ok(strategy) => strategy.config_dir(),
                Err(_) => legacy_path,
            }
        }
    }
}

pub fn file_exclude_patterns_path() -> PathBuf {
    app_root().join(APP_FILE_EXCLUDE_PATTERNS_PATH)
}

fn read_file_exclude_patterns_from_path(path: &Path, fallback: Option<&str>) -> String {
    let fallback = fallback.unwrap_or(DEFAULT_EXCLUDE_PATTERNS).to_string();
    std::fs::read_to_string(path).unwrap_or(fallback)
}

fn read_file_exclude_patterns(fallback: Option<&str>) -> String {
    read_file_exclude_patterns_from_path(&file_exclude_patterns_path(), fallback)
}

fn write_file_exclude_patterns(patterns: &str) {
    let path = file_exclude_patterns_path();

    if let Some(parent) = path.parent() {
        if let Err(err) = std::fs::create_dir_all(parent) {
            eprintln!("Failed to create directory {:?}: {}", parent, err);
        }
    }

    if let Err(err) = std::fs::write(&path, patterns) {
        eprintln!(
            "Failed to write file exclude patterns to {:?}: {}",
            path, err
        );
    }
}

fn migrate_from_file(_app: &AppHandle) -> Option<AppConf> {
    let legacy_path = app_root().join(APP_CONF_PATH);
    if exists(&legacy_path) {
        match std::fs::read_to_string(&legacy_path) {
            Ok(content) => {
                if let Ok(conf) = serde_json::from_str::<AppConf>(&content) {
                    return Some(conf);
                }
            }
            Err(_) => {}
        }
    }
    None
}

impl AppConf {
    pub fn system_theme() -> Theme {
        match dark_light::detect() {
            dark_light::Mode::Dark => Theme::Dark,
            dark_light::Mode::Light | dark_light::Mode::Default => Theme::Light,
        }
    }

    pub fn system_theme_name() -> &'static str {
        match Self::system_theme() {
            Theme::Dark => "dark",
            Theme::Light => "light",
            _ => "light",
        }
    }

    pub fn new() -> Self {
        Self {
            theme: Some("light".to_string()),
            theme_mode: Some("system".to_string()),
            theme_accent_color: Some("system".to_string()),
            light_theme: Some("MarkFlowy Light".to_string()),
            dark_theme: Some("MarkFlowy Dark".to_string()),
            language: Some("en".to_string()),
            auto_update: Some(false),
            webview_zoom: Some("1.0".to_string()),
            copilot_provider: Some("".to_string()),
            copilot_model: Some("".to_string()),
            copilot_enabled: Some(false),
            editor_full_width: Some(false),
            editor_typewriter_scroll: Some(false),
            editor_placeholder: Some(true),
            editor_insert_date_format: Some("YYYY-MM-DD".to_string()),
            editor_root_font_size: Some(16),
            editor_root_line_height: Some("1.65".to_string()),
            md_editor_default_mode: Some("wysiwyg".to_string()),
            autosave: Some(false),
            autosave_interval: Some(2000),
            editor_root_font_family: Some("System Default".to_string()),
            editor_code_font_family: Some("Default Monospace".to_string()),
            wysiwyg_editor_spellcheck: Some(false),
            source_code_editor_spellcheck: Some(false),
            wysiwyg_editor_codemirror_line_wrap: Some(true),
            wysiwyg_editor_live_preview_block_behavior: Some("auto".to_string()),
            file_exclude_patterns: Some(DEFAULT_EXCLUDE_PATTERNS.to_string()),
            extensions_chatgpt_apibase: Some("".to_string()),
            extensions_chatgpt_models: Some("gpt-3.5-turbo,gpt-4-32k,gpt-4".to_string()),
            extensions_chatgpt_apikey: Some("".to_string()),
            extensions_chatgpt_request_headers: Some(HashMap::new()),
            extensions_deepseek_models: Some("deepseek-chat,deepseek-reasoner".to_string()),
            extensions_deepseek_apibase: Some("".to_string()),
            extensions_deepseek_apikey: Some("".to_string()),
            extensions_deepseek_request_headers: Some(HashMap::new()),
            extensions_ollama_models: Some(String::new()),
            extensions_ollama_apibase: Some("".to_string()),
            extensions_ollama_request_headers: Some(HashMap::new()),
            extensions_google_models: Some("gemini-2.5-flash".to_string()),
            extensions_google_apibase: Some("".to_string()),
            extensions_google_apikey: Some("".to_string()),
            extensions_google_request_headers: Some(HashMap::new()),
            when_paste_image: Some("do_nothing".to_string()),
            paste_image_save_absolute_path: None,
            paste_image_save_relative_path: Some("assets/images".to_string()),
            paste_image_save_relative_path_rule: Some("${documentPath}/assets".to_string()),
            when_upload_image: Some("save_to_local_absolute".to_string()),
            upload_image_save_absolute_path: Some(
                app_root()
                    .join("assets/images")
                    .to_str()
                    .unwrap()
                    .to_string(),
            ),
            upload_image_save_relative_path: Some("assets/images".to_string()),
            upload_image_save_relative_path_rule: Some("${documentPath}/assets".to_string()),
            dialog_preferences: Some(HashMap::new()),
        }
    }

    pub fn file_path() -> PathBuf {
        app_root().join(APP_CONF_PATH)
    }

    pub fn with_file_exclude_patterns_from_file(mut self) -> Self {
        self.file_exclude_patterns = Some(read_file_exclude_patterns(
            self.file_exclude_patterns.as_deref(),
        ));
        self
    }

    pub fn write_file_exclude_patterns(&self) {
        if let Some(patterns) = self.file_exclude_patterns.as_deref() {
            write_file_exclude_patterns(patterns);
        }
    }

    pub fn read_from_store(app: &AppHandle) -> Result<Self, String> {
        let store = create_store(app)?;

        if let Some(value) = store.get(STORE_KEY) {
            match serde_json::from_value::<AppConf>(value.clone()) {
                Ok(conf) => Ok(conf),
                Err(e) => Err(format!("Failed to deserialize config: {}", e)),
            }
        } else {
            // Store 中没有配置，尝试从旧文件迁移
            if let Some(migrated_conf) = migrate_from_file(app) {
                // 将迁移的配置写入 Store
                let value = serde_json::to_value(&migrated_conf)
                    .map_err(|error| format!("Failed to serialize migrated config: {error}"))?;
                save_store_value(&store, STORE_KEY, value)?;
                let legacy_path = app_root().join(APP_CONF_PATH);
                if exists(&legacy_path) {
                    let _ = std::fs::remove_file(&legacy_path);
                }
                Ok(migrated_conf)
            } else {
                // Absence is not a migration and reads must remain side-effect
                // free. The first explicit save persists the merged defaults.
                Ok(Self::new())
            }
        }
    }

    pub fn write_to_store(self, app: &AppHandle) -> Result<Self, String> {
        let store = create_store(app)?;

        let value = serde_json::to_value(&self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        save_store_value(&store, STORE_KEY, value)?;
        Ok(self)
    }

    /**
     * merge old config
     *
     * Generally used to be compatible with the original config when versions are different.
     */
    pub fn merge_conf(mut self, oldconf: AppConf) -> Self {
        merge_options!(
            self,
            oldconf,
            theme,
            theme_mode,
            theme_accent_color,
            light_theme,
            dark_theme,
            language,
            autosave,
            auto_update,
            webview_zoom,
            copilot_provider,
            copilot_model,
            copilot_enabled,
            editor_full_width,
            editor_typewriter_scroll,
            editor_placeholder,
            editor_insert_date_format,
            editor_root_font_size,
            editor_root_line_height,
            md_editor_default_mode,
            editor_root_font_family,
            editor_code_font_family,
            wysiwyg_editor_codemirror_line_wrap,
            wysiwyg_editor_live_preview_block_behavior,
            wysiwyg_editor_spellcheck,
            source_code_editor_spellcheck,
            file_exclude_patterns,
            autosave_interval,
            extensions_chatgpt_apibase,
            extensions_chatgpt_apikey,
            extensions_chatgpt_models,
            extensions_chatgpt_request_headers,
            extensions_deepseek_models,
            extensions_deepseek_apibase,
            extensions_deepseek_apikey,
            extensions_deepseek_request_headers,
            extensions_ollama_models,
            extensions_ollama_apibase,
            extensions_ollama_request_headers,
            extensions_google_models,
            extensions_google_apibase,
            extensions_google_apikey,
            extensions_google_request_headers,
            when_paste_image,
            paste_image_save_absolute_path,
            paste_image_save_relative_path,
            paste_image_save_relative_path_rule,
            when_upload_image,
            upload_image_save_absolute_path,
            upload_image_save_relative_path,
            upload_image_save_relative_path_rule,
            dialog_preferences
        );

        self
    }

    pub fn read_with_app(app: &AppHandle) -> Self {
        APP_CONF_CACHE
            .get_or_init(|| {
                let started_at = Instant::now();
                let conf = match Self::read_from_store(app) {
                    Ok(conf) => conf.with_file_exclude_patterns_from_file(),
                    Err(err) => {
                        eprintln!(
                            "Failed to read from store: {}, falling back to defaults",
                            err
                        );
                        Self::default().with_file_exclude_patterns_from_file()
                    }
                };
                tracing::debug!(
                    marker = "config-loaded",
                    elapsed_ms = started_at.elapsed().as_millis() as u64,
                    "Startup config snapshot loaded"
                );
                RwLock::new(Self::new().merge_conf(conf))
            })
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .clone()
    }

    pub fn write_with_app(self, app: &AppHandle) -> Self {
        match self.clone().write_to_store(app) {
            Ok(conf) => {
                conf.write_file_exclude_patterns();
                replace_cached_conf(conf.clone());
                conf
            }
            Err(err) => {
                eprintln!("Failed to write to store: {err}");
                Self::read_with_app(app)
            }
        }
    }

    pub fn try_write_with_app(self, app: &AppHandle) -> Result<Self, String> {
        let conf = self.write_to_store(app)?;
        conf.write_file_exclude_patterns();
        replace_cached_conf(conf.clone());
        Ok(conf)
    }

    pub fn try_reset_with_app(self, app: &AppHandle) -> Result<Self, String> {
        let conf = self.write_to_store(app)?;
        conf.write_file_exclude_patterns();
        let legacy_path = Self::file_path();
        if exists(&legacy_path) {
            let _ = std::fs::remove_file(&legacy_path);
        }
        replace_cached_conf(conf.clone());
        Ok(conf)
    }

    pub fn amend(self, json: Value) -> Self {
        let val = serde_json::to_value(&self).unwrap();
        let mut config: BTreeMap<String, Value> = serde_json::from_value(val).unwrap();
        let new_json: BTreeMap<String, Value> = serde_json::from_value(json).unwrap();

        for (k, v) in new_json {
            config.insert(k, v);
        }

        match serde_json::to_string_pretty(&config) {
            Ok(_v) => match serde_json::from_value::<AppConf>(serde_json::Value::Object(
                config
                    .into_iter()
                    .collect::<serde_json::Map<String, Value>>(),
            )) {
                Ok(v) => v,
                Err(_err) => self,
            },
            Err(_err) => self,
        }
    }

    pub fn get_theme_with_app(app: &AppHandle) -> String {
        Self::read_with_app(app).theme.unwrap().to_lowercase()
    }

    fn theme_id_for_mode(&self, mode: ResolvedThemeMode) -> String {
        let configured = match mode {
            ResolvedThemeMode::Dark => self.dark_theme.as_deref(),
            ResolvedThemeMode::Light => self.light_theme.as_deref(),
        };

        configured
            .filter(|value| !value.trim().is_empty())
            .unwrap_or(match mode {
                ResolvedThemeMode::Dark => "MarkFlowy Dark",
                ResolvedThemeMode::Light => "MarkFlowy Light",
            })
            .to_string()
    }

    pub fn startup_appearance(app: &AppHandle) -> StartupAppearance {
        // A valid dedicated snapshot avoids opening the full settings Store on
        // the pre-window path. Only first-run/upgrade fallback reads the legacy
        // Store, and system mode is re-resolved for every native window.
        // Match config commits' lock order so a newly-created window cannot
        // observe an appearance from the middle of a theme settings commit.
        let _config_guard = CONFIG_STORE_WRITE_LOCK
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let _write_guard = STARTUP_APPEARANCE_WRITE_LOCK
            .lock()
            .unwrap_or_else(|error| error.into_inner());
        let cached = startup_appearance_cache()
            .read()
            .unwrap_or_else(|error| error.into_inner())
            .clone();
        let source = if cached.is_some() {
            "snapshot"
        } else {
            "fallback"
        };
        let appearance = cached.unwrap_or_else(|| startup_appearance_fallback(app));
        tracing::debug!(
            marker = "bootstrap-appearance",
            source,
            "Startup appearance resolved"
        );

        if appearance.preference == ThemePreference::System {
            appearance.resolve_system_mode(current_resolved_system_mode())
        } else {
            appearance
        }
    }

    pub fn save_startup_appearance(
        app: &AppHandle,
        appearance: StartupAppearance,
    ) -> Result<bool, String> {
        appearance.validate()?;
        // Use the same lock order as config commits. An appearance from action
        // A that arrives after config B is stale and must not recreate the file.
        let _config_guard = CONFIG_STORE_WRITE_LOCK
            .lock()
            .map_err(|_| "Failed to lock config store writer".to_string())?;
        let conf = Self::read_with_app(app);
        if !appearance.matches_conf_identity(&conf) {
            tracing::debug!(
                marker = "appearance-write-stale",
                "Discarded startup appearance whose config identity is no longer current"
            );
            return Ok(false);
        }
        let _write_guard = STARTUP_APPEARANCE_WRITE_LOCK
            .lock()
            .map_err(|_| "Failed to lock startup appearance writer".to_string())?;
        persist_startup_appearance_snapshot(appearance)?;
        Ok(true)
    }

    pub fn theme_mode(app: &AppHandle) -> Theme {
        let conf = Self::read_with_app(app);
        let mode = conf.theme_mode.unwrap_or_else(|| "system".to_string());

        match mode.as_str() {
            "system" => Self::system_theme(),
            "dark" => Theme::Dark,
            _ => Theme::Light,
        }
    }

    /// Returns None when theme_mode is "system", so the window follows the OS preference.
    /// Otherwise returns Some(Theme) for explicit light/dark mode.
    pub fn theme_mode_for_window(app: &AppHandle) -> Option<Theme> {
        let conf = Self::read_with_app(app);
        ThemePreference::from_config(conf.theme_mode.as_deref()).native_window_theme()
    }

    pub fn theme_mode_with_app(app: &AppHandle) -> Theme {
        Self::theme_mode(app)
    }
}

impl Default for AppConf {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::{
        invalidate_startup_appearance_snapshot, startup_theme_identity_changed, AppConf,
        StartupAppearance, CONFIG_COMMAND_WRITE_QUEUE, CONFIG_STORE_WRITE_LOCK,
        STARTUP_APPEARANCE_COMMAND_WRITE_QUEUE, STARTUP_APPEARANCE_WRITE_LOCK,
    };
    use crate::app::startup_io;
    use tauri::{command, AppHandle, WebviewUrl, WebviewWindowBuilder};

    #[command]
    pub async fn get_app_conf(app: AppHandle) -> Result<AppConf, String> {
        startup_io::run(move || {
            let _read_guard = CONFIG_STORE_WRITE_LOCK
                .lock()
                .map_err(|_| "Failed to lock config store reader".to_string())?;
            Ok(AppConf::read_with_app(&app))
        })
        .await
        .map_err(|error| format!("Failed to join config reader: {error}"))?
    }

    #[command]
    pub async fn reset_app_conf(app: AppHandle) -> Result<AppConf, String> {
        let _queue_guard = CONFIG_COMMAND_WRITE_QUEUE.lock().await;
        startup_io::run(move || {
            let _write_guard = CONFIG_STORE_WRITE_LOCK
                .lock()
                .map_err(|_| "Failed to lock config store writer".to_string())?;
            let _appearance_guard = STARTUP_APPEARANCE_WRITE_LOCK
                .lock()
                .map_err(|_| "Failed to lock startup appearance writer".to_string())?;
            // Invalidate first: a crash before the config commit will fall back
            // to the still-valid old config instead of a mismatched palette.
            invalidate_startup_appearance_snapshot()?;
            AppConf::default().try_reset_with_app(&app)
        })
        .await
        .map_err(|error| format!("Failed to join config reset: {error}"))?
    }

    #[command]
    pub async fn save_app_conf(app: AppHandle, data: serde_json::Value) -> Result<AppConf, String> {
        let _queue_guard = CONFIG_COMMAND_WRITE_QUEUE.lock().await;
        startup_io::run(move || {
            let _write_guard = CONFIG_STORE_WRITE_LOCK
                .lock()
                .map_err(|_| "Failed to lock config store writer".to_string())?;
            let current = AppConf::read_with_app(&app);
            let candidate = current.clone().amend(data);

            if startup_theme_identity_changed(&current, &candidate) {
                let _appearance_guard = STARTUP_APPEARANCE_WRITE_LOCK
                    .lock()
                    .map_err(|_| "Failed to lock startup appearance writer".to_string())?;
                // Deleting before committing config makes every interruption
                // safe: startup either reads the old config or the new config,
                // never a stale appearance identity.
                invalidate_startup_appearance_snapshot()?;
                candidate.try_write_with_app(&app)
            } else {
                candidate.try_write_with_app(&app)
            }
        })
        .await
        .map_err(|error| format!("Failed to join config writer: {error}"))?
    }

    #[command]
    pub async fn save_startup_appearance(
        app: AppHandle,
        appearance: StartupAppearance,
    ) -> Result<bool, String> {
        let _queue_guard = STARTUP_APPEARANCE_COMMAND_WRITE_QUEUE.lock().await;
        startup_io::run(move || AppConf::save_startup_appearance(&app, appearance))
            .await
            .map_err(|error| format!("Failed to join startup appearance writer: {error}"))?
    }

    #[command]
    pub fn get_system_theme() -> String {
        AppConf::system_theme_name().to_string()
    }

    #[command]
    pub fn open_conf_window(app: AppHandle) {
        let theme = AppConf::theme_mode_for_window(&app);

        tauri::async_runtime::spawn(async move {
            let conf_win =
                WebviewWindowBuilder::new(&app, "conf", WebviewUrl::App("./setting".into()))
                    .title("markflowy setting")
                    .resizable(true)
                    .fullscreen(false)
                    .theme(theme)
                    .inner_size(1000.0, 600.0)
                    .min_inner_size(500.0, 500.0);

            // #[cfg(target_os = "macos")]
            // {
            //     conf_win = conf_win
            //         .title_bar_style(TitleBarStyle::Overlay)
            //         .hidden_title(true);
            // }

            conf_win.build().unwrap();
        });
    }
}

#[cfg(test)]
mod tests {
    use super::{
        parse_hex_color, read_file_exclude_patterns_from_path, read_startup_appearance_file,
        remove_startup_appearance_file, startup_appearance_changed, startup_theme_identity_changed,
        write_startup_appearance_file, AppConf, ResolvedThemeMode, StartupAppearance,
        StartupPalette, ThemePreference, STARTUP_APPEARANCE_SCHEMA_VERSION,
    };
    fn valid_appearance() -> StartupAppearance {
        StartupAppearance {
            schema_version: STARTUP_APPEARANCE_SCHEMA_VERSION,
            theme_id: "MarkFlowy Dark".to_string(),
            preference: ThemePreference::Dark,
            resolved_mode: ResolvedThemeMode::Dark,
            palette: StartupPalette::fallback(ResolvedThemeMode::Dark),
        }
    }

    fn empty_conf() -> AppConf {
        serde_json::from_value(serde_json::json!({})).expect("empty config")
    }

    #[test]
    fn missing_exclude_patterns_read_has_no_write_side_effect() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("markflowy-ignore");

        assert_eq!(
            read_file_exclude_patterns_from_path(&path, Some(".git\n")),
            ".git\n"
        );
        assert!(!path.exists());
    }

    #[test]
    fn startup_appearance_accepts_safe_hex_palettes() {
        assert!(valid_appearance().validate().is_ok());
        assert_eq!(
            parse_hex_color("#123"),
            Some(tauri::webview::Color(17, 34, 51, 255))
        );
        assert_eq!(
            parse_hex_color("#1234"),
            Some(tauri::webview::Color(17, 34, 51, 68))
        );
        assert_eq!(
            parse_hex_color("#123456"),
            Some(tauri::webview::Color(18, 52, 86, 255))
        );
        assert_eq!(
            parse_hex_color("#12345678"),
            Some(tauri::webview::Color(18, 52, 86, 120))
        );
    }

    #[test]
    fn startup_appearance_rejects_css_and_unsupported_schema() {
        let mut appearance = valid_appearance();
        appearance.palette.surface_app = "var(--mf-background)".to_string();
        assert!(appearance.validate().is_err());

        let mut appearance = valid_appearance();
        appearance.schema_version += 1;
        assert!(appearance.validate().is_err());

        let mut appearance = valid_appearance();
        appearance.palette.surface_app = "#13131380".to_string();
        assert!(appearance.validate().is_err());
    }

    #[test]
    fn startup_appearance_rejects_control_characters_in_theme_id() {
        let mut appearance = valid_appearance();
        appearance.theme_id = "dark\nscript".to_string();
        assert!(appearance.validate().is_err());
    }

    #[test]
    fn startup_appearance_only_persists_material_changes() {
        let current = valid_appearance();
        assert!(!startup_appearance_changed(Some(&current), &current));

        let mut changed = current.clone();
        changed.palette.accent = "#1234".to_string();
        assert!(startup_appearance_changed(Some(&current), &changed));
        assert!(startup_appearance_changed(None, &current));
    }

    #[test]
    fn startup_appearance_re_resolves_only_system_mode() {
        let mut system = valid_appearance();
        system.preference = ThemePreference::System;
        let resolved = system.resolve_system_mode(ResolvedThemeMode::Light);
        assert_eq!(resolved.preference, ThemePreference::System);
        assert_eq!(resolved.resolved_mode, ResolvedThemeMode::Light);
        assert_eq!(resolved.theme_id, "MarkFlowy Light");
        assert_eq!(
            resolved.palette,
            StartupPalette::fallback(ResolvedThemeMode::Light)
        );

        let explicit = valid_appearance();
        assert_eq!(
            explicit
                .clone()
                .resolve_system_mode(ResolvedThemeMode::Light),
            explicit
        );
    }

    #[test]
    fn startup_theme_identity_ignores_unrelated_settings() {
        let current = empty_conf();
        let unrelated = current
            .clone()
            .amend(serde_json::json!({ "extensions_chatgpt_apikey": "secret" }));
        assert!(!startup_theme_identity_changed(&current, &unrelated));

        let changed = current
            .clone()
            .amend(serde_json::json!({ "theme_mode": "dark" }));
        assert!(startup_theme_identity_changed(&current, &changed));
    }

    #[test]
    fn startup_appearance_rejects_an_older_theme_identity() {
        let light_conf = empty_conf().amend(serde_json::json!({
            "theme_mode": "light",
            "light_theme": "MarkFlowy Light"
        }));
        assert!(!valid_appearance().matches_conf_identity(&light_conf));

        let dark_conf = empty_conf().amend(serde_json::json!({
            "theme_mode": "dark",
            "dark_theme": "MarkFlowy Dark"
        }));
        assert!(valid_appearance().matches_conf_identity(&dark_conf));
    }

    #[test]
    fn startup_appearance_identity_includes_the_accent_override() {
        let dark_conf = empty_conf().amend(serde_json::json!({
            "theme_mode": "dark",
            "dark_theme": "MarkFlowy Dark",
            "theme_accent_color": "#abc"
        }));
        let mut appearance = valid_appearance();
        assert!(!appearance.matches_conf_identity(&dark_conf));

        appearance.palette.accent = "#aabbcc".to_string();
        assert!(appearance.matches_conf_identity(&dark_conf));
    }

    #[test]
    fn startup_appearance_file_is_small_validated_and_atomic() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("startup_appearance_v1.json");
        let appearance = valid_appearance();

        write_startup_appearance_file(&path, &appearance).expect("write appearance");
        assert_eq!(read_startup_appearance_file(&path), Some(appearance));

        let content = std::fs::read_to_string(&path).expect("read appearance file");
        assert!(content.len() < 1024);
        let serialized: serde_json::Value =
            serde_json::from_str(&content).expect("parse appearance file");
        let mut top_level_keys = serialized
            .as_object()
            .expect("appearance object")
            .keys()
            .map(String::as_str)
            .collect::<Vec<_>>();
        top_level_keys.sort_unstable();
        assert_eq!(
            top_level_keys,
            [
                "palette",
                "preference",
                "resolvedMode",
                "schemaVersion",
                "themeId"
            ]
        );
        assert_eq!(
            directory
                .path()
                .read_dir()
                .expect("read temp directory")
                .count(),
            1
        );
    }

    #[test]
    fn startup_appearance_file_rejects_invalid_snapshots() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("startup_appearance_v1.json");
        std::fs::write(
            &path,
            r##"{"schemaVersion":1,"themeId":"unsafe","preference":"dark","resolvedMode":"dark","palette":{"surfaceApp":"var(--secret)","surfacePanel":"#111","surfaceToolbar":"#111","foreground":"#fff","mutedForeground":"#aaa","border":"#333","accent":"#09f"}}"##,
        )
        .expect("write invalid appearance");

        assert_eq!(read_startup_appearance_file(&path), None);
    }

    #[test]
    fn startup_appearance_file_invalidation_is_idempotent() {
        let directory = tempfile::tempdir().expect("tempdir");
        let path = directory.path().join("startup_appearance_v1.json");
        write_startup_appearance_file(&path, &valid_appearance()).expect("write appearance");

        remove_startup_appearance_file(&path).expect("invalidate appearance");
        assert!(!path.exists());
        remove_startup_appearance_file(&path).expect("repeat invalidation");
    }
}
