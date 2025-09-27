use crate::{
    fc::{create_file, exists},
    APP_DIR,
};
use etcetera::{choose_app_strategy, AppStrategy, AppStrategyArgs};
use serde_json::Value;
use std::{collections::BTreeMap, path::PathBuf};
use tauri::{Manager, Theme};

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
    editor_full_width: Option<bool>,
    editor_root_font_size: Option<u32>,
    editor_root_line_height: Option<String>,
    extensions_chatgpt_apibase: Option<String>,
    extensions_chatgpt_apikey: Option<String>,
    extensions_chatgpt_models: Option<String>,
    extensions_deepseek_apibase: Option<String>,
    extensions_deepseek_apikey: Option<String>,
    extensions_deepseek_models: Option<String>,
    extensions_ollama_apibase: Option<String>,
    extensions_ollama_models: Option<String>,
    autosave: Option<bool>,
    autosave_interval: Option<u32>,
    editor_root_font_family: Option<String>,
    editor_code_font_family: Option<String>,
    md_editor_default_mode: Option<String>,
    when_paste_image: Option<String>,
    paste_image_save_absolute_path: Option<String>,
    paste_image_save_relative_path: Option<String>,
});

pub const APP_CONF_PATH: &str = "markflowy.conf.json";

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

impl AppConf {
    pub fn new() -> Self {
        Self {
            theme: Some("light".to_string()),
            language: Some("en".to_string()),
            auto_update: Some(false),
            editor_full_width: Some(false),
            editor_root_font_size: Some(15),
            editor_root_line_height: Some("1.6".to_string()),
            md_editor_default_mode: Some("wysiwyg".to_string()),
            autosave: Some(false),
            autosave_interval: Some(2000),
            editor_root_font_family: Some("Open Sans".to_string()),
            editor_code_font_family: Some("Fira Code".to_string()),
            extensions_chatgpt_apibase: Some("".to_string()),
            extensions_chatgpt_models: Some("gpt-3.5-turbo,gpt-4-32k,gpt-4".to_string()),
            extensions_chatgpt_apikey: Some("".to_string()),
            extensions_deepseek_models: Some("deepseek-chat,deepseek-reasoner".to_string()),
            extensions_deepseek_apibase: Some("".to_string()),
            extensions_deepseek_apikey: Some("".to_string()),
            extensions_ollama_models: Some("llama3.3".to_string()),
            extensions_ollama_apibase: Some("".to_string()),
            when_paste_image: Some("do_nothing".to_string()),
            paste_image_save_absolute_path: None,
            paste_image_save_relative_path: Some("assets/images".to_string()),
        }
    }

    pub fn file_path() -> PathBuf {
        app_root().join(APP_CONF_PATH)
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
            language,
            autosave,
            auto_update,
            editor_full_width,
            editor_root_font_size,
            editor_root_line_height,
            md_editor_default_mode,
            editor_root_font_family,
            editor_code_font_family,
            autosave_interval,
            extensions_chatgpt_apibase,
            extensions_chatgpt_apikey,
            extensions_chatgpt_models,
            extensions_deepseek_models,
            extensions_deepseek_apibase,
            extensions_deepseek_apikey,
            extensions_ollama_models,
            extensions_ollama_apibase,
            when_paste_image,
            paste_image_save_absolute_path,
            paste_image_save_relative_path
        );

        self.write()
    }

    pub fn read() -> Self {
        match std::fs::read_to_string(Self::file_path()) {
            Ok(v) => match serde_json::from_str::<AppConf>(&v) {
                Ok(v) => return Self::new().merge_conf(v),
                Err(_err) => Self::default().write(),
            },
            Err(err) => {
                print!("read err,{}", err);
                Self::default()
            }
        }
    }

    pub fn write(self) -> Self {
        let path = &Self::file_path();
        if !exists(path) {
            create_file(path);
        }
        if let Ok(v) = serde_json::to_string_pretty(&self) {
            std::fs::write(path, v).unwrap_or_else(|_err| {
                Self::default().write();
            });
        } else {
        }
        self
    }

    pub fn reset(self) -> Self {
        let path = &Self::file_path();
        if exists(path) {
            std::fs::remove_file(path).unwrap_or_else(|_err| {
                Self::default().write();
            });
        }
        if let Ok(v) = serde_json::to_string_pretty(&self) {
            std::fs::write(path, v).unwrap_or_else(|_err| {
                Self::default().write();
            });
        } else {
        }
        self
    }

    pub fn amend(self, json: Value) -> Self {
        let val = serde_json::to_value(&self).unwrap();
        let mut config: BTreeMap<String, Value> = serde_json::from_value(val).unwrap();
        let new_json: BTreeMap<String, Value> = serde_json::from_value(json).unwrap();

        for (k, v) in new_json {
            config.insert(k, v);
        }

        match serde_json::to_string_pretty(&config) {
            Ok(v) => match serde_json::from_str::<AppConf>(&v) {
                Ok(v) => v,
                Err(_err) => self,
            },
            Err(_err) => self,
        }
    }

    pub fn get_theme() -> String {
        Self::read().theme.unwrap().to_lowercase()
    }

    pub fn theme_mode() -> Theme {
        let cur_theme = Self::get_theme().to_string();

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

    pub fn theme_check(self, mode: &str) -> bool {
        self.theme.unwrap().to_lowercase() == mode
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
    pub fn get_app_conf_path() -> String {
        AppConf::file_path().to_str().unwrap().to_string()
    }

    #[command]
    pub fn get_app_conf() -> AppConf {
        AppConf::read()
    }

    #[command]
    pub fn reset_app_conf() -> AppConf {
        AppConf::default().reset()
    }

    #[command]
    pub fn save_app_conf(_app: AppHandle, data: serde_json::Value) {
        AppConf::read().amend(serde_json::json!(data)).write();
    }

    #[command]
    pub fn open_conf_window(_app: AppHandle) {
        let theme = AppConf::theme_mode();

        tauri::async_runtime::spawn(async move {
            let conf_win =
                WebviewWindowBuilder::new(&_app, "conf", WebviewUrl::App("./setting".into()))
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
