use crate::fc::{create_file, exists};
use serde_json::Value;
use std::{collections::BTreeMap, path::PathBuf};
use tauri::Theme;

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
    extensions_chatgpt_apikey: Option<String>,
    autosave: Option<bool>,
    autosave_interval: Option<u32>,
});

pub const APP_CONF_PATH: &str = "linebyline.conf.json";

pub fn app_root() -> PathBuf {
    tauri::api::path::home_dir().unwrap().join(".linebyline")
}

impl AppConf {
    pub fn new() -> Self {
        Self {
            theme: Some("light".to_string()),
            language: Some("en".to_string()),
            autosave: Some(false),
            autosave_interval: Some(2000),
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
        if oldconf.autosave_interval.is_some() {
            self.autosave_interval = oldconf.autosave_interval;
        }
        if oldconf.extensions_chatgpt_apikey.is_some() {
            self.extensions_chatgpt_apikey = oldconf.extensions_chatgpt_apikey;
        }
        self.write()
    }

    pub fn read() -> Self {
        match std::fs::read_to_string(Self::file_path()) {
            Ok(v) => {
                match serde_json::from_str::<AppConf>(&v) {
                    Ok(v) => return Self::new().merge_conf(v),
                    Err(err) => {
                        Self::default().write()
                    }
                }
            }
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
            std::fs::write(path, v).unwrap_or_else(|err| {
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
                Err(err) => self,
            },
            Err(err) => self,
        }
    }

    pub fn get_theme() -> String {
        Self::read().theme.unwrap().to_lowercase()
    }

    pub fn theme_mode() -> Theme {
        match Self::get_theme().as_str() {
            "system" => match dark_light::detect() {
                dark_light::Mode::Dark => Theme::Dark,
                dark_light::Mode::Light => Theme::Light,
                dark_light::Mode::Default => Theme::Light,
            },
            "dark" => Theme::Dark,
            _ => Theme::Light,
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
    use tauri::{command, AppHandle, WindowBuilder, WindowUrl};

    #[cfg(target_os = "macos")]
    use tauri::TitleBarStyle;

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
            let mut conf_win =
                WindowBuilder::new(&_app, "conf", WindowUrl::App("./setting".into()))
                    .title("linebyline setting")
                    .resizable(true)
                    .fullscreen(false)
                    .theme(Some(theme))
                    .inner_size(1000.0, 600.0)
                    .min_inner_size(500.0, 500.0);

            #[cfg(target_os = "macos")]
            {
                conf_win = conf_win
                    .title_bar_style(TitleBarStyle::Overlay)
                    .hidden_title(true);
            }

            conf_win.build().unwrap();
        });
    }
}
