//! Declarative themes only. Theme files are data and are never executed.
use super::conf;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::BTreeMap,
    io::{Read, Write},
    path::Path,
    sync::Mutex,
};
static THEME_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeLibrary {
    pub revision: u64,
    pub documents: Vec<Value>,
    pub snippets: Vec<CssSnippet>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CssSnippet {
    pub id: String,
    pub name: String,
    pub css: String,
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_file: Option<String>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemeLibraryResponse {
    #[serde(flatten)]
    library: ThemeLibrary,
    snippet_directory: String,
    snippet_errors: Vec<String>,
    transient_snippets: bool,
}
const EXTERNAL_SNIPPET_PREFIX: &str = "css-file:";
const MAX_SNIPPET_BYTES: u64 = 1024 * 1024;

fn external_snippet_id(name: &str) -> String {
    let suffix: String = name
        .as_bytes()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("{EXTERNAL_SNIPPET_PREFIX}{suffix}")
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
    fn refresh_for_read(&mut self, directory: &Path, path: &Path) -> (Vec<String>, bool) {
        let persisted_revision = self.revision;
        let (changed, mut errors) = self.refresh_snippets(directory);
        if changed {
            if let Err(error) = self.write(path) {
                // Return the discovered CSS without inventing a persisted revision.
                // The client can refresh subsequent temporary snapshots at this revision.
                self.revision = persisted_revision;
                errors.push(format!("Could not save discovered CSS snippets: {error}"));
                return (errors, true);
            }
        }
        (errors, false)
    }
    fn refresh_snippets(&mut self, directory: &Path) -> (bool, Vec<String>) {
        // An unavailable CSS directory must not prevent theme loading or edits.
        // The scanner commits only after a complete listing, preserving saved
        // external identities, enable state and ordering when listing fails.
        self.sync_snippet_directory(directory)
            .unwrap_or_else(|error| (false, vec![format!("{}: {error}", directory.display())]))
    }
    // File names are identities, not display labels. This preserves ordering and
    // enable state across external edits without colliding with imported snippets.
    fn sync_snippet_directory(&mut self, directory: &Path) -> Result<(bool, Vec<String>), String> {
        std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        let mut files = BTreeMap::new();
        let mut errors = Vec::new();
        for entry in std::fs::read_dir(directory).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if !path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("css"))
            {
                continue;
            }
            // Do not follow symlinks or read directories/special files.
            if !entry
                .file_type()
                .map_err(|error| error.to_string())?
                .is_file()
            {
                continue;
            }
            let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
                errors.push(format!("{}: file name is not UTF-8", path.display()));
                continue;
            };
            let read_css = || -> Result<String, String> {
                let file = std::fs::File::open(&path).map_err(|error| error.to_string())?;
                let mut bytes = Vec::new();
                file.take(MAX_SNIPPET_BYTES + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|error| error.to_string())?;
                if bytes.len() as u64 > MAX_SNIPPET_BYTES {
                    return Err("CSS file exceeds 1 MiB".into());
                }
                if bytes.contains(&0) {
                    return Err("CSS file contains binary data".into());
                }
                String::from_utf8(bytes).map_err(|_| "CSS file is not UTF-8".into())
            };
            let css = match read_css() {
                Ok(css) => css,
                Err(error) => {
                    errors.push(format!("{name}: {error}"));
                    // Keep the saved identity/order but remove stale styling while invalid.
                    String::new()
                }
            };
            files.insert(
                external_snippet_id(&name),
                CssSnippet {
                    id: external_snippet_id(&name),
                    name,
                    css,
                    enabled: false,
                    source_file: Some(path.to_string_lossy().into_owned()),
                },
            );
        }
        let mut snippets = Vec::new();
        for previous in &self.snippets {
            if previous.source_file.is_none() {
                snippets.push(previous.clone());
            } else if let Some(mut current) = files.remove(&previous.id) {
                current.enabled = previous.enabled;
                snippets.push(current);
            }
        }
        snippets.extend(files.into_values());
        let changed = snippets != self.snippets;
        if changed {
            self.snippets = snippets;
            self.revision += 1;
        }
        Ok((changed, errors))
    }
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
                    if self.snippets[index].source_file.is_some() {
                        // The disk is authoritative. A stale UI toggle must not overwrite a file edit.
                        self.snippets[index].enabled = snippet.enabled;
                    } else if snippet.source_file.is_some() {
                        return Err("Cannot change a snippet's file source".into());
                    } else {
                        self.snippets[index] = snippet;
                    }
                } else {
                    if snippet.source_file.is_some()
                        || snippet.id.starts_with(EXTERNAL_SNIPPET_PREFIX)
                    {
                        return Err("External CSS file is no longer available".into());
                    }
                    self.snippets.push(snippet);
                }
            }
            ThemeMutation::RemoveSnippet { id } => {
                if self
                    .snippets
                    .iter()
                    .any(|snippet| snippet.id == id && snippet.source_file.is_some())
                {
                    return Err("Delete external CSS files in the snippets directory".into());
                }
                self.snippets.retain(|snippet| snippet.id != id);
            }
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
    pub async fn get_theme_library() -> Result<ThemeLibraryResponse, String> {
        super::super::startup_io::run(|| {
            let _guard = THEME_LOCK.lock().map_err(|error| error.to_string())?;
            let path = conf::app_root().join("themes-v1.json");
            let directory = conf::app_root().join("css-snippets");
            let mut library = ThemeLibrary::read(&path)?;
            let (snippet_errors, transient_snippets) = library.refresh_for_read(&directory, &path);
            Ok::<_, String>(ThemeLibraryResponse {
                library,
                snippet_directory: directory.to_string_lossy().into_owned(),
                snippet_errors,
                transient_snippets,
            })
        })
        .await
        .map_err(|error| error.to_string())?
    }
    #[tauri::command]
    pub async fn mutate_theme_library(
        app: tauri::AppHandle,
        mutation: ThemeMutation,
    ) -> Result<ThemeLibraryResponse, String> {
        let library = super::super::startup_io::run(move || {
            let _guard = THEME_LOCK.lock().map_err(|error| error.to_string())?;
            let path = conf::app_root().join("themes-v1.json");
            let mut library = ThemeLibrary::read(&path)?;
            let directory = conf::app_root().join("css-snippets");
            let (_, snippet_errors) = library.refresh_snippets(&directory);
            library.apply(mutation)?;
            library.write(&path)?;
            Ok::<_, String>(ThemeLibraryResponse {
                library,
                snippet_directory: directory.to_string_lossy().into_owned(),
                snippet_errors,
                transient_snippets: false,
            })
        })
        .await
        .map_err(|error| error.to_string())??;
        let _ = app.emit("themes-changed", library.library.revision);
        Ok(library)
    }
    #[tauri::command]
    pub async fn open_css_snippets_directory(app: tauri::AppHandle) -> Result<(), String> {
        use tauri_plugin_opener::OpenerExt;
        let directory = super::super::startup_io::run(|| {
            let directory = conf::app_root().join("css-snippets");
            std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
            Ok::<_, String>(directory.to_string_lossy().into_owned())
        })
        .await
        .map_err(|error| error.to_string())??;
        app.opener()
            .open_path(directory, None::<&str>)
            .map_err(|error| error.to_string())
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
                        source_file: None,
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

    #[test]
    fn external_files_refresh_without_losing_order_or_enable_state() {
        let dir = tempfile::tempdir().unwrap();
        let a = dir.path().join("same.css");
        let b = dir.path().join("second.CSS");
        std::fs::write(&a, "p { color: red }").unwrap();
        std::fs::write(&b, "h1 { color: blue }").unwrap();
        let mut library = ThemeLibrary::default();
        library.snippets.push(CssSnippet {
            id: "imported".into(),
            name: "same.css".into(),
            css: "a{}".into(),
            enabled: true,
            source_file: None,
        });
        assert!(library.sync_snippet_directory(dir.path()).unwrap().0);
        assert_eq!(library.snippets.len(), 3);
        assert!(!library.snippets[1].enabled);
        let id = external_snippet_id("same.css");
        let mut old = library
            .snippets
            .iter()
            .find(|item| item.id == id)
            .unwrap()
            .clone();
        old.enabled = true;
        library
            .apply(ThemeMutation::SaveSnippet {
                snippet: old.clone(),
            })
            .unwrap();
        library
            .apply(ThemeMutation::MoveSnippet {
                id: id.clone(),
                offset: -2,
            })
            .unwrap();
        let revision = library.revision;
        assert!(!library.sync_snippet_directory(dir.path()).unwrap().0);
        assert_eq!(library.revision, revision);
        std::fs::write(&a, "p { color: green }").unwrap();
        library.sync_snippet_directory(dir.path()).unwrap();
        // A delayed UI toggle carries old text; disk contents must still win.
        library
            .apply(ThemeMutation::SaveSnippet { snippet: old })
            .unwrap();
        assert_eq!(library.snippets[0].id, id);
        assert_eq!(library.snippets[0].css, "p { color: green }");
        assert!(library.snippets[0].enabled);
        std::fs::remove_file(a).unwrap();
        library.sync_snippet_directory(dir.path()).unwrap();
        assert_eq!(library.snippets.len(), 2);
        assert_eq!(library.snippets[0].id, "imported");
        assert!(library
            .apply(ThemeMutation::RemoveSnippet {
                id: external_snippet_id("second.CSS")
            })
            .is_err());
    }

    #[test]
    fn invalid_files_clear_stale_styles_and_recover_without_resetting_preferences() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("valid.css");
        std::fs::write(&path, "p{}").unwrap();
        std::fs::write(dir.path().join("notes.txt"), "ignored").unwrap();
        std::fs::create_dir(dir.path().join("folder.css")).unwrap();
        let mut library = ThemeLibrary::default();
        library.sync_snippet_directory(dir.path()).unwrap();
        library.snippets[0].enabled = true;
        let id = library.snippets[0].id.clone();
        for bytes in [
            vec![0xff, 0xfe],
            vec![0],
            vec![b' '; MAX_SNIPPET_BYTES as usize + 1],
        ] {
            std::fs::write(&path, bytes).unwrap();
            let (_, errors) = library.sync_snippet_directory(dir.path()).unwrap();
            assert_eq!(errors.len(), 1);
            assert_eq!(library.snippets.len(), 1);
            assert_eq!(library.snippets[0].id, id);
            assert!(library.snippets[0].css.is_empty());
            assert!(library.snippets[0].enabled);
        }
        std::fs::write(&path, "h1{}").unwrap();
        assert!(library
            .sync_snippet_directory(dir.path())
            .unwrap()
            .1
            .is_empty());
        assert_eq!(library.snippets[0].css, "h1{}");
        assert!(library.snippets[0].enabled);
    }

    #[test]
    fn external_ids_survive_reload_and_cannot_be_forged_by_mutations() {
        let dir = tempfile::tempdir().unwrap();
        let directory = dir.path().join("css-snippets");
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("中文.css"), "p{}").unwrap();
        let mut library = ThemeLibrary::default();
        library.sync_snippet_directory(&directory).unwrap();
        library.snippets[0].enabled = true;
        let path = dir.path().join("themes.json");
        library.write(&path).unwrap();
        let mut loaded = ThemeLibrary::read(&path).unwrap();
        assert!(!loaded.sync_snippet_directory(&directory).unwrap().0);
        assert_eq!(loaded.snippets, library.snippets);
        let forged = CssSnippet {
            id: "forged".into(),
            name: "fake".into(),
            css: "body{}".into(),
            enabled: true,
            source_file: Some("/outside.css".into()),
        };
        assert!(loaded
            .apply(ThemeMutation::SaveSnippet { snippet: forged })
            .is_err());
        std::fs::rename(directory.join("中文.css"), directory.join("renamed.css")).unwrap();
        loaded.sync_snippet_directory(&directory).unwrap();
        assert_eq!(loaded.snippets.len(), 1);
        assert!(!loaded.snippets[0].enabled);
        assert_ne!(loaded.snippets[0].id, library.snippets[0].id);
        let legacy: CssSnippet =
            serde_json::from_str(r#"{"id":"legacy","name":"Old","css":"p{}","enabled":true}"#)
                .unwrap();
        assert!(legacy.source_file.is_none());
    }

    #[test]
    fn unavailable_directory_preserves_library_and_does_not_block_mutations() {
        let dir = tempfile::tempdir().unwrap();
        let directory = dir.path().join("css-snippets");
        std::fs::create_dir(&directory).unwrap();
        std::fs::write(directory.join("external.css"), "h1{}").unwrap();
        let mut library = ThemeLibrary::default();
        library
            .apply(ThemeMutation::Save {
                document: document(),
                replace: false,
            })
            .unwrap();
        library.refresh_snippets(&directory);
        library.snippets[0].enabled = true;
        let original = library.snippets.clone();
        let revision = library.revision;
        // Replacing the directory with an ordinary file reproduces creation and
        // enumeration failures without depending on OS privilege or chmod semantics.
        std::fs::rename(&directory, dir.path().join("backup")).unwrap();
        std::fs::write(&directory, "not a directory").unwrap();
        let (changed, errors) = library.refresh_snippets(&directory);
        assert!(!changed);
        assert_eq!(errors.len(), 1);
        assert_eq!(library.revision, revision);
        assert_eq!(library.snippets, original);
        assert_eq!(library.documents.len(), 1);
        library
            .apply(ThemeMutation::SaveSnippet {
                snippet: CssSnippet {
                    id: "internal".into(),
                    name: "Internal".into(),
                    css: "p{}".into(),
                    enabled: true,
                    source_file: None,
                },
            })
            .unwrap();
        library
            .apply(ThemeMutation::Save {
                document: document(),
                replace: true,
            })
            .unwrap();
        let path = dir.path().join("themes.json");
        library.write(&path).unwrap();
        let mut loaded = ThemeLibrary::read(&path).unwrap();
        assert_eq!(loaded.snippets[0], original[0]);
        assert_eq!(loaded.snippets[1].id, "internal");
        std::fs::remove_file(&directory).unwrap();
        std::fs::rename(dir.path().join("backup"), &directory).unwrap();
        let (changed, errors) = loaded.refresh_snippets(&directory);
        assert!(!changed);
        assert!(errors.is_empty());
        assert_eq!(loaded.snippets[0], original[0]);
    }

    #[test]
    fn failed_automatic_persistence_keeps_themes_and_fresh_css_until_retry_succeeds() {
        let dir = tempfile::tempdir().unwrap();
        let directory = dir.path().join("css-snippets");
        let path = dir.path().join("themes.json");
        let blocked = dir.path().join("blocked.json");
        std::fs::create_dir(&directory).unwrap();
        std::fs::create_dir(&blocked).unwrap();
        let css_path = directory.join("external.css");
        std::fs::write(&css_path, "p{}").unwrap();
        let mut saved = ThemeLibrary::default();
        saved
            .apply(ThemeMutation::Save {
                document: document(),
                replace: false,
            })
            .unwrap();
        saved.refresh_snippets(&directory);
        saved.snippets[0].enabled = true;
        saved.write(&path).unwrap();
        for css in ["h1{}", "h2{}"] {
            std::fs::write(&css_path, css).unwrap();
            let mut loaded = ThemeLibrary::read(&path).unwrap();
            let (errors, transient) = loaded.refresh_for_read(&directory, &blocked);
            assert!(transient);
            assert_eq!(errors.len(), 1);
            assert_eq!(loaded.documents, saved.documents);
            assert_eq!(loaded.revision, saved.revision);
            assert_eq!(loaded.snippets[0].css, css);
            assert!(loaded.snippets[0].enabled);
            assert_eq!(ThemeLibrary::read(&path).unwrap().snippets, saved.snippets);
        }
        let mut recovered = ThemeLibrary::read(&path).unwrap();
        let (errors, transient) = recovered.refresh_for_read(&directory, &path);
        assert!(!transient);
        assert!(errors.is_empty());
        assert!(recovered.revision > saved.revision);
        assert_eq!(ThemeLibrary::read(&path).unwrap().snippets[0].css, "h2{}");
        // Explicit saves still receive the persistence error.
        recovered.apply(ThemeMutation::DisableSnippets).unwrap();
        assert!(recovered.write(&blocked).is_err());
    }
}
