//! Declarative themes only. Theme files are data and are never executed.
use super::conf;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{io::Write, path::Path, sync::Mutex};
static THEME_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeLibrary {
    pub revision: u64,
    pub documents: Vec<Value>,
    pub snippets: Vec<CssSnippet>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CssSnippet {
    pub id: String,
    pub name: String,
    pub css: String,
    pub enabled: bool,
}
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ThemeMutation {
    Save { document: Value, replace: bool },
    Remove { id: String },
    SaveSnippet { snippet: CssSnippet },
    RemoveSnippet { id: String },
    MoveSnippet { id: String, offset: i32 },
    DisableSnippets,
}
fn validate_document(document: &Value) -> Result<(), String> {
    let valid_id = |id: &str| {
        id.bytes()
            .next()
            .is_some_and(|first| first.is_ascii_lowercase() || first.is_ascii_digit())
            && id.len() <= 80
            && id
                .bytes()
                .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || b"._-".contains(&c))
    };
    if document["version"].as_u64() != Some(1)
        || !document["id"].as_str().map(valid_id).unwrap_or(false)
        || document["name"].as_str().unwrap_or("").trim().is_empty()
    {
        return Err("Invalid theme document".into());
    }
    let variants = document["variants"].as_array().ok_or("Missing variants")?;
    if variants.is_empty() || variants.len() > 32 {
        return Err("Invalid variants".into());
    }
    let mut ids = std::collections::HashSet::new();
    for variant in variants {
        let id = variant["id"].as_str().ok_or("Missing variant id")?;
        if !valid_id(id)
            || !ids.insert(id)
            || !matches!(variant["mode"].as_str(), Some("light" | "dark"))
            || variant["name"].as_str().unwrap_or("").trim().is_empty()
        {
            return Err("Invalid variant".into());
        }
        if let Some(css) = variant.get("css") {
            if !css.is_string() {
                return Err("Invalid CSS".into());
            }
        }
        if let Some(tokens) = variant.get("tokens") {
            let tokens = tokens.as_object().ok_or("Invalid tokens")?;
            // Persist only the wire format. Token names, kinds and reference
            // graphs are validated by the shared semantic registry in TS.
            for value in tokens.values() {
                let valid = match value {
                    Value::String(text) => !text.trim().is_empty(),
                    Value::Object(reference) => {
                        reference.len() == 1
                            && reference
                                .get("ref")
                                .and_then(Value::as_str)
                                .is_some_and(|name| !name.trim().is_empty())
                    }
                    _ => false,
                };
                if !valid {
                    return Err("Invalid token value".into());
                }
            }
        }
    }
    Ok(())
}
impl ThemeLibrary {
    fn read(path: &Path) -> Result<Self, String> {
        match std::fs::read_to_string(path) {
            Ok(text) => serde_json::from_str(&text).map_err(|error| error.to_string()),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(error) => Err(error.to_string()),
        }
    }
    fn write(&self, path: &Path) -> Result<(), String> {
        let directory = path.parent().ok_or("Missing theme directory")?;
        std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        let mut temporary = tempfile::Builder::new()
            .prefix(".themes-")
            .tempfile_in(directory)
            .map_err(|error| error.to_string())?;
        temporary
            .write_all(&serde_json::to_vec_pretty(self).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
        temporary
            .as_file()
            .sync_all()
            .map_err(|error| error.to_string())?;
        temporary
            .persist(path)
            .map_err(|error| error.error.to_string())?;
        Ok(())
    }
    fn apply(&mut self, mutation: ThemeMutation) -> Result<(), String> {
        match mutation {
            ThemeMutation::Save { document, replace } => {
                validate_document(&document)?;
                if let Some(index) = self
                    .documents
                    .iter()
                    .position(|old| old["id"] == document["id"])
                {
                    if !replace {
                        return Err("Theme id already exists".into());
                    }
                    self.documents[index] = document;
                } else {
                    self.documents.push(document);
                }
            }
            ThemeMutation::Remove { id } => self.documents.retain(|document| document["id"] != id),
            ThemeMutation::SaveSnippet { snippet } => {
                if snippet.id.trim().is_empty() || snippet.name.trim().is_empty() {
                    return Err("Missing snippet id or name".into());
                }
                if let Some(index) = self.snippets.iter().position(|old| old.id == snippet.id) {
                    self.snippets[index] = snippet;
                } else {
                    self.snippets.push(snippet);
                }
            }
            ThemeMutation::RemoveSnippet { id } => self.snippets.retain(|snippet| snippet.id != id),
            ThemeMutation::MoveSnippet { id, offset } => {
                if let Some(index) = self.snippets.iter().position(|snippet| snippet.id == id) {
                    let target = (index as i64 + i64::from(offset))
                        .clamp(0, self.snippets.len().saturating_sub(1) as i64)
                        as usize;
                    let snippet = self.snippets.remove(index);
                    self.snippets.insert(target, snippet);
                }
            }
            ThemeMutation::DisableSnippets => {
                for snippet in &mut self.snippets {
                    snippet.enabled = false;
                }
            }
        }
        self.revision += 1;
        Ok(())
    }
}
pub mod cmd {
    use super::*;
    use tauri::Emitter;
    #[tauri::command]
    pub async fn get_theme_library() -> Result<ThemeLibrary, String> {
        super::super::startup_io::run(|| {
            let _guard = THEME_LOCK.lock().map_err(|error| error.to_string())?;
            ThemeLibrary::read(&conf::app_root().join("themes-v1.json"))
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[tauri::command]
    pub async fn mutate_theme_library(
        app: tauri::AppHandle,
        mutation: ThemeMutation,
    ) -> Result<ThemeLibrary, String> {
        let library = super::super::startup_io::run(move || {
            let _guard = THEME_LOCK.lock().map_err(|error| error.to_string())?;
            let path = conf::app_root().join("themes-v1.json");
            let mut library = ThemeLibrary::read(&path)?;
            library.apply(mutation)?;
            library.write(&path)?;
            Ok::<_, String>(library)
        })
        .await
        .map_err(|error| error.to_string())??;
        let _ = app.emit("themes-changed", library.revision);
        Ok(library)
    }
}
#[cfg(test)]
mod tests {
    use super::*;

    fn document() -> Value {
        serde_json::json!({
            "version": 1,
            "id": "test",
            "name": "Test",
            "variants": [{
                "id": "light",
                "name": "Light",
                "mode": "light",
                "tokens": {
                    "surface.canvas": "#ffffff",
                    "editor.background": { "ref": "surface.canvas" }
                }
            }]
        })
    }

    fn assert_failed_save_preserves_library(invalid: Value) {
        let mut library = ThemeLibrary::default();
        library
            .apply(ThemeMutation::Save {
                document: document(),
                replace: false,
            })
            .unwrap();
        let before = serde_json::to_value(&library).unwrap();
        assert!(
            library
                .apply(ThemeMutation::Save {
                    document: invalid.clone(),
                    replace: true,
                })
                .is_err(),
            "accepted invalid document: {invalid}"
        );
        assert_eq!(serde_json::to_value(&library).unwrap(), before);
        assert_eq!(library.revision, 1);
    }

    #[test]
    fn atomic_roundtrip_and_failed_duplicate() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("themes.json");
        let mut library = ThemeLibrary::default();
        let document = serde_json::json!({"version":1,"id":"test","name":"Test","variants":[{"id":"light","name":"Light","mode":"light"}]});
        library
            .apply(ThemeMutation::Save {
                document: document.clone(),
                replace: false,
            })
            .unwrap();
        library.write(&path).unwrap();
        assert!(library
            .apply(ThemeMutation::Save {
                document,
                replace: false
            })
            .is_err());
        assert_eq!(library.revision, 1);
        assert_eq!(library.documents.len(), 1);
        assert_eq!(ThemeLibrary::read(&path).unwrap().revision, 1);
    }

    #[test]
    fn ids_match_the_semantic_parser_format() {
        for id in [".theme", "_theme", "-theme", "", "Theme", "主题"] {
            let mut invalid = document();
            invalid["id"] = id.into();
            assert_failed_save_preserves_library(invalid);
            let mut invalid = document();
            invalid["variants"][0]["id"] = id.into();
            assert_failed_save_preserves_library(invalid);
        }
        for id in ["a", "0-theme", "theme.v1_light-dark"] {
            let mut valid = document();
            valid["id"] = id.into();
            valid["variants"][0]["id"] = id.into();
            assert!(validate_document(&valid).is_ok());
        }
        let mut invalid = document();
        invalid["id"] = "a".repeat(81).into();
        assert_failed_save_preserves_library(invalid);
    }

    #[test]
    fn invalid_variant_shapes_leave_saved_themes_unchanged() {
        for variants in [
            serde_json::json!(null),
            serde_json::json!({}),
            serde_json::json!([]),
            serde_json::json!([null]),
            serde_json::json!([{"id":"light","name":"Light","mode":"system"}]),
            serde_json::json!([{"id":"light","name":" ","mode":"light"}]),
            serde_json::json!([{"id":"light","name":"Light","mode":"light","css":true}]),
        ] {
            let mut invalid = document();
            invalid["variants"] = variants;
            assert_failed_save_preserves_library(invalid);
        }
        let mut invalid = document();
        let variant = invalid["variants"][0].clone();
        invalid["variants"] = serde_json::json!([variant.clone(), variant]);
        assert_failed_save_preserves_library(invalid);
    }

    #[test]
    fn invalid_token_shapes_do_not_advance_revision() {
        for tokens in [serde_json::json!(null), serde_json::json!([])] {
            let mut invalid = document();
            invalid["variants"][0]["tokens"] = tokens;
            assert_failed_save_preserves_library(invalid);
        }
        for value in [
            serde_json::json!(null),
            serde_json::json!(42),
            serde_json::json!(true),
            serde_json::json!([]),
            serde_json::json!(" "),
            serde_json::json!({}),
            serde_json::json!({"ref":42}),
            serde_json::json!({"ref":""}),
            serde_json::json!({"ref":"surface.canvas","extra":true}),
        ] {
            let mut invalid = document();
            invalid["variants"][0]["tokens"]["editor.background"] = value;
            assert_failed_save_preserves_library(invalid);
        }
    }

    #[test]
    fn snippets_keep_order_and_can_be_disabled() {
        let mut library = ThemeLibrary::default();
        for id in ["a", "b"] {
            library
                .apply(ThemeMutation::SaveSnippet {
                    snippet: CssSnippet {
                        id: id.into(),
                        name: id.into(),
                        css: String::new(),
                        enabled: true,
                    },
                })
                .unwrap();
        }
        library
            .apply(ThemeMutation::MoveSnippet {
                id: "b".into(),
                offset: -1,
            })
            .unwrap();
        assert_eq!(library.snippets[0].id, "b");
        library.apply(ThemeMutation::DisableSnippets).unwrap();
        assert!(library.snippets.iter().all(|snippet| !snippet.enabled));
    }
}
