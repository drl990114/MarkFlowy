use super::conf;
use crate::fc::{create_file, exists};
use serde::{Deserialize, Serialize};
use std::{path::Path, path::PathBuf, vec};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Bookmark {
    pub id: String,
    pub title: String,
    pub path: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BookMarks {
    bookmarks: Vec<Bookmark>,
    version: String,
}

impl BookMarks {
    pub fn new() -> Self {
        Self {
            bookmarks: vec![].into_iter().collect(),
            version: "0.0.1".to_string(),
        }
    }

    pub fn get_path() -> PathBuf {
        conf::app_root().join("bookmarks.json")
    }

    pub fn read() -> Self {
        match std::fs::read_to_string(Self::get_path()) {
            Ok(v) => {
                if let Ok(mut v2) = serde_json::from_str::<BookMarks>(&v) {
                    v2.bookmarks.retain(|item| exists(Path::new(&item.path)));
                    v2.write()
                } else {
                    Self::default()
                }
            }
            Err(_err) => Self::default(),
        }
    }

    pub fn write(self) -> Self {
        let path = &Self::get_path();
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

    pub fn rename_item(mut self, id: String, title: String) -> Self {
        self.bookmarks.iter_mut().for_each(|item| {
            if item.id == id {
                item.title = title.clone();
            }
        });
        self.write()
    }

    pub fn edit_item(mut self, target: Bookmark) -> Self {
        self.bookmarks.iter_mut().for_each(|item| {
            if item.id == target.id {
                item.title = target.title.clone();
                item.path = target.path.clone();
                item.tags = target.tags.clone();
            }
        });
        self.write()
    }

    pub fn add_item(mut self, item: Bookmark) -> Self {
        self.bookmarks.push(item);
        self.write()
    }

    pub fn remove_item(mut self, id: String) -> Self {
        self.bookmarks.retain(|item| item.id != id);
        self.write()
    }
}

impl Default for BookMarks {
    fn default() -> Self {
        Self::new()
    }
}

pub mod cmd {
    use super::{BookMarks, Bookmark};
    use tauri::command;

    #[command]
    pub fn get_bookmarks() -> BookMarks {
        BookMarks::read()
    }

    #[command]
    pub fn add_bookmark(item: Bookmark) -> BookMarks {
        BookMarks::read().add_item(item)
    }

    #[command]
    pub fn edit_bookmark(item: Bookmark) -> BookMarks {
        BookMarks::read().edit_item(item)
    }

    #[command]
    pub fn remove_bookmark(id: String) -> BookMarks {
        BookMarks::read().remove_item(id)
    }

    #[command]
    pub fn rename_bookmark_item(id: String, title: String) -> BookMarks {
        BookMarks::read().rename_item(id, title)
    }
}
