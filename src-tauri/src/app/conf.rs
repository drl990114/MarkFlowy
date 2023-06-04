use serde_json::Value;
use std::{collections::BTreeMap, path::PathBuf};
use crate::fc::{create_file, exists};

macro_rules! pub_struct {
  ($name:ident {$($field:ident: $t:ty,)*}) => {
    #[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
    pub struct $name {
      $(pub $field: $t),*
    }
  }
}

pub_struct!(AppConf {
  language: String,
  extensions_chatgpt_apikey: String,
});

pub const APP_CONF_PATH: &str = "linebyline.conf.json";

pub fn app_root() -> PathBuf {
  tauri::api::path::home_dir().unwrap().join(".linebyline")
}

impl AppConf {
  pub fn new() -> Self {
    Self {
      language: "en".to_string(),
      extensions_chatgpt_apikey: "".to_string(),
    }
  }

  pub fn file_path() -> PathBuf {
    app_root().join(APP_CONF_PATH)
  }

  pub fn read() -> Self {
    match std::fs::read_to_string(Self::file_path()) {
      Ok(v) => {
        if let Ok(v2) = serde_json::from_str::<AppConf>(&v) {
          v2
        } else {
          Self::default()
        }
      }
      Err(err) => {
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
        Err(err) => {
          self
        }
      },
      Err(err) => {
        self
      }
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
  use tauri::{command, AppHandle};

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
}
