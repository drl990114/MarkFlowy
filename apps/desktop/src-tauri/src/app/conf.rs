use crate::{
    fc::exists,
    APP_DIR,
};
use etcetera::{choose_app_strategy, AppStrategy, AppStrategyArgs};
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashMap},
    path::PathBuf,
};
use tauri::{AppHandle, Manager, Theme};
use tauri_plugin_store::{Store, StoreBuilder};

macro_rules! pub_struct {
  ($name:ident {$($field:ident: $t:ty,)*}) => {
    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
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
    language: Option<String>,
    auto_update: Option<bool>,
    webview_zoom: Option<String>,
    editor_full_width: Option<bool>,
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
    md_editor_default_mode: Option<String>,
    when_paste_image: Option<String>,
    paste_image_save_absolute_path: Option<String>,
    paste_image_save_relative_path: Option<String>,
    paste_image_save_relative_path_rule: Option<String>,
    when_upload_image: Option<String>,
    upload_image_save_absolute_path: Option<String>,
    upload_image_save_relative_path: Option<String>,
    upload_image_save_relative_path_rule: Option<String>,
});

pub const APP_CONF_PATH: &str = "markflowy.conf.json";
pub const STORE_KEY: &str = "app_config_v3";

fn create_store(app: &AppHandle) -> Result<std::sync::Arc<Store<tauri::Wry>>, String> {
    let store_path = "markflowy_store.bin";

    StoreBuilder::new(app.app_handle(), store_path)
        .build()
        .map_err(|e| format!("Failed to build store: {:?}", e))
}

pub fn app_root() -> PathBuf {
    let app_dir = APP_DIR.lock().unwrap();
    let home_dir = app_dir.get(&0).unwrap();
    let legacy_path = home_dir.join(".markflowy");

    // If legacy config exists, keep using it for backward compatibility
    if exists(&legacy_path) {
        return legacy_path;
    }

    // Use platform-specific paths via etcetera
    #[cfg(target_os = "windows")]
    {
        // Keep Windows behavior exactly the same
        legacy_path
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Use XDG paths on Linux/macOS with proper fallback
        match choose_app_strategy(AppStrategyArgs {
            top_level_domain: "com".to_string(),
            author: "drl990114".to_string(),
            app_name: "markflowy".to_string(),
        }) {
            Ok(strategy) => strategy.config_dir(),
            Err(_) => legacy_path, // Fallback to legacy path if something goes wrong
        }
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
    pub fn new() -> Self {
        Self {
            theme: Some("light".to_string()),
            language: Some("en".to_string()),
            auto_update: Some(false),
            webview_zoom: Some("1.0".to_string()),
            editor_full_width: Some(false),
            editor_root_font_size: Some(15),
            editor_root_line_height: Some("1.6".to_string()),
            md_editor_default_mode: Some("wysiwyg".to_string()),
            autosave: Some(false),
            autosave_interval: Some(2000),
            editor_root_font_family: Some("Open Sans".to_string()),
            editor_code_font_family: Some("Fira Code".to_string()),
            wysiwyg_editor_codemirror_line_wrap: Some(true),
            extensions_chatgpt_apibase: Some("".to_string()),
            extensions_chatgpt_models: Some("gpt-3.5-turbo,gpt-4-32k,gpt-4".to_string()),
            extensions_chatgpt_apikey: Some("".to_string()),
            extensions_chatgpt_request_headers: Some(HashMap::new()),
            extensions_deepseek_models: Some("deepseek-chat,deepseek-reasoner".to_string()),
            extensions_deepseek_apibase: Some("".to_string()),
            extensions_deepseek_apikey: Some("".to_string()),
            extensions_deepseek_request_headers: Some(HashMap::new()),
            extensions_ollama_models: Some("llama3.3".to_string()),
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
        }
    }

    pub fn file_path() -> PathBuf {
        app_root().join(APP_CONF_PATH)
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
                let _ = store.set(
                    STORE_KEY.to_string(),
                    serde_json::to_value(&migrated_conf).unwrap(),
                );
                let _ = store.save();
                let legacy_path = app_root().join(APP_CONF_PATH);
                if exists(&legacy_path) {
                    let _ = std::fs::remove_file(&legacy_path);
                }
                Ok(migrated_conf)
            } else {
                // 使用默认配置
                let default_conf = Self::new();
                let _ = store.set(
                    STORE_KEY.to_string(),
                    serde_json::to_value(&default_conf).unwrap(),
                );
                let _ = store.save();
                Ok(default_conf)
            }
        }
    }

    pub fn write_to_store(self, app: &AppHandle) -> Result<Self, String> {
        let store = create_store(app)?;

        let value = serde_json::to_value(&self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;

        store.set(STORE_KEY.to_string(), value);
        store
            .save()
            .map_err(|e| format!("Failed to save store: {:?}", e))?;
        Ok(self)
    }

    /**
     * merge old config
     *
     * Generally used to be compatible with the original config when versions are different.
     */
    pub fn merge_conf(mut self, oldconf: AppConf, app: &AppHandle) -> Self {
        merge_options!(
            self,
            oldconf,
            theme,
            language,
            autosave,
            auto_update,
            webview_zoom,
            editor_full_width,
            editor_root_font_size,
            editor_root_line_height,
            md_editor_default_mode,
            editor_root_font_family,
            editor_code_font_family,
            wysiwyg_editor_codemirror_line_wrap,
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
            upload_image_save_relative_path_rule
        );

        self.write_with_app(app)
    }

    pub fn read_with_app(app: &AppHandle) -> Self {
        match Self::read_from_store(app) {
            Ok(conf) => Self::new().merge_conf(conf, app),
            Err(err) => {
                eprintln!("Failed to read from store: {}, falling back to file", err);
                Self::default()
            }
        }
    }

    pub fn write_with_app(self, app: &AppHandle) -> Self {
        match self.clone().write_to_store(app) {
            Ok(conf) => conf,
            Err(err) => {
                eprintln!("Failed to write to store: {}, falling back to file", err);
                Self::default()
            }
        }
    }

    pub fn reset_with_app(self, app: &AppHandle) -> Self {
        let store = match create_store(app) {
            Ok(store) => store,
            Err(_) => return Self::default(),
        };

        store.delete(STORE_KEY);
        if store.save().is_ok() {
            let legacy_path = Self::file_path();
            if exists(&legacy_path) {
                let _ = std::fs::remove_file(&legacy_path);
            }
            return self
                .clone()
                .write_to_store(app)
                .unwrap_or_else(|_| Self::default());
        }

        Self::default()
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

    pub fn theme_mode(app: &AppHandle) -> Theme {
        let cur_theme = Self::get_theme_with_app(app).to_string();

        if cur_theme == "system" {
            let mode = match dark_light::detect() {
                dark_light::Mode::Dark => Theme::Dark,
                dark_light::Mode::Light => Theme::Light,
                dark_light::Mode::Default => Theme::Light,
            };

            return mode;
        }

        let dark = cur_theme.to_lowercase().to_string().contains("dark");
        if dark {
            Theme::Dark
        } else {
            Theme::Light
        }
    }

    pub fn theme_mode_with_app(app: &AppHandle) -> Theme {
        let cur_theme = Self::get_theme_with_app(app).to_string();

        if cur_theme == "system" {
            let mode = match dark_light::detect() {
                dark_light::Mode::Dark => Theme::Dark,
                dark_light::Mode::Light => Theme::Light,
                dark_light::Mode::Default => Theme::Light,
            };

            return mode;
        }

        let dark = cur_theme.to_lowercase().to_string().contains("dark");
        if dark {
            Theme::Dark
        } else {
            Theme::Light
        }
    }
}

impl Default for AppConf {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::AppConf;
    use tauri::{command, AppHandle, WebviewUrl, WebviewWindowBuilder};

    #[command]
    pub fn get_app_conf(app: AppHandle) -> AppConf {
        AppConf::read_with_app(&app)
    }

    #[command]
    pub fn reset_app_conf(app: AppHandle) -> AppConf {
        AppConf::default().reset_with_app(&app)
    }

    #[command]
    pub fn save_app_conf(app: AppHandle, data: serde_json::Value) {
        AppConf::read_with_app(&app)
            .amend(serde_json::json!(data))
            .write_with_app(&app);
    }

    #[command]
    pub fn open_conf_window(app: AppHandle) {
        let theme = AppConf::theme_mode_with_app(&app);

        tauri::async_runtime::spawn(async move {
            let conf_win =
                WebviewWindowBuilder::new(&app, "conf", WebviewUrl::App("./setting".into()))
                    .title("markflowy setting")
                    .resizable(true)
                    .fullscreen(false)
                    .theme(Some(theme))
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
