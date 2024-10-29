use crate::{
    fc::{create_file, exists},
    APP_DIR,
};
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
    autosave: Option<bool>,
    autosave_interval: Option<u32>,
});

pub const APP_CONF_PATH: &str = "markflowy.conf.json";

pub fn app_root() -> PathBuf {
    APP_DIR.lock().unwrap().get(&0).unwrap().join(".markflowy")
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
            autosave: Some(false),
            autosave_interval: Some(2000),
            extensions_chatgpt_apibase: Some("https://api.openai.com/v1/chat/completions".to_string()),
            extensions_chatgpt_models: Some("gpt-3.5-turbo, gpt-4-32k, gpt-4".to_string()),
            extensions_chatgpt_apikey: Some("".to_string()),
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
        if oldconf.theme.is_some() {
            self.theme = oldconf.theme;
        }
        if oldconf.language.is_some() {
            self.language = oldconf.language;
        }
        if oldconf.autosave.is_some() {
            self.autosave = oldconf.autosave;
        }
        if oldconf.auto_update.is_some() {
            self.auto_update = oldconf.auto_update;
        }
        if oldconf.editor_full_width.is_some() {
            self.editor_full_width = oldconf.editor_full_width;
        }
        if oldconf.editor_root_font_size.is_some() {
            self.editor_root_font_size = oldconf.editor_root_font_size;
        }
        if oldconf.editor_root_line_height.is_some() {
            self.editor_root_line_height = oldconf.editor_root_line_height;
        }
        if oldconf.autosave_interval.is_some() {
            self.autosave_interval = oldconf.autosave_interval;
        }
        if oldconf.extensions_chatgpt_apibase.is_some() {
            self.extensions_chatgpt_apibase = oldconf.extensions_chatgpt_apibase;
        }
        if oldconf.extensions_chatgpt_apikey.is_some() {
            self.extensions_chatgpt_apikey = oldconf.extensions_chatgpt_apikey;
        }
        if oldconf.extensions_chatgpt_models.is_some() {
            self.extensions_chatgpt_models = oldconf.extensions_chatgpt_models;
        }
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
        AppConf::default().write()
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
