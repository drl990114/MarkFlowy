use super::conf;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, io::Write, path::Path, sync::Mutex};

static SNIPPETS_LOCK: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum SnippetBody {
    Math,
    Mermaid,
    Code {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        language: Option<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Snippet {
    id: String,
    title: String,
    source: String,
    #[serde(flatten)]
    body: SnippetBody,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnippetLibrary {
    version: u32,
    revision: u64,
    items: Vec<Snippet>,
    hidden_builtin_ids: Vec<String>,
}

impl Default for SnippetLibrary {
    fn default() -> Self {
        Self {
            version: 1,
            revision: 0,
            items: Vec::new(),
            hidden_builtin_ids: Vec::new(),
        }
    }
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum SnippetMutation {
    Upsert { item: Snippet },
    Delete { id: String },
    BuiltinVisibility { id: String, hidden: bool },
}

impl Snippet {
    fn validate(&self) -> Result<(), String> {
        if self.id.trim().is_empty()
            || self.id.starts_with("builtin:")
            || self.title.trim().is_empty()
            || self.source.trim().is_empty()
        {
            return Err("snippets_invalid: id, title and source are required".into());
        }
        if let SnippetBody::Code {
            language: Some(language),
        } = &self.body
        {
            if language.contains(['\r', '\n', '`']) {
                return Err("snippets_invalid: invalid code language".into());
            }
        }
        Ok(())
    }
}

impl SnippetLibrary {
    fn read_from(path: &Path) -> Result<Self, String> {
        let content = match std::fs::read_to_string(path) {
            Ok(content) => content,
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                return Ok(Self::default())
            }
            Err(error) => return Err(format!("snippets_read_failed: {error}")),
        };
        let library: Self =
            serde_json::from_str(&content).map_err(|error| format!("snippets_invalid: {error}"))?;
        if library.version != 1 {
            return Err("snippets_unsupported_version".into());
        }
        let mut ids = HashSet::new();
        for item in &library.items {
            item.validate()?;
            if !ids.insert(&item.id) {
                return Err("snippets_invalid: duplicate id".into());
            }
        }
        Ok(library)
    }

    fn write_to(&self, path: &Path) -> Result<(), String> {
        let directory = path
            .parent()
            .ok_or("snippets_write_failed: missing parent")?;
        std::fs::create_dir_all(directory).map_err(|error| error.to_string())?;
        let content = serde_json::to_vec_pretty(self).map_err(|error| error.to_string())?;
        let mut temporary = tempfile::Builder::new()
            .prefix(".snippets-")
            .tempfile_in(directory)
            .map_err(|error| error.to_string())?;
        if let Ok(metadata) = std::fs::metadata(path) {
            temporary
                .as_file()
                .set_permissions(metadata.permissions())
                .map_err(|error| error.to_string())?;
        }
        temporary
            .write_all(&content)
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

    fn apply(&mut self, mutation: SnippetMutation) -> Result<(), String> {
        match mutation {
            SnippetMutation::Upsert { mut item } => {
                item.validate()?;
                item.title = item.title.trim().to_owned();
                if let Some(existing) = self
                    .items
                    .iter_mut()
                    .find(|existing| existing.id == item.id)
                {
                    *existing = item;
                } else {
                    self.items.push(item);
                }
            }
            SnippetMutation::Delete { id } => {
                if !self.items.iter().any(|item| item.id == id) {
                    return Err("snippets_not_found".into());
                }
                self.items.retain(|item| item.id != id);
            }
            SnippetMutation::BuiltinVisibility { id, hidden } => {
                if !id.starts_with("builtin:") {
                    return Err("snippets_invalid: expected built-in id".into());
                }
                self.hidden_builtin_ids.retain(|existing| existing != &id);
                if hidden {
                    self.hidden_builtin_ids.push(id);
                }
            }
        }
        self.revision = self
            .revision
            .checked_add(1)
            .ok_or("snippets_revision_overflow")?;
        Ok(())
    }
}

fn mutate(
    path: &Path,
    expected_revision: u64,
    mutation: SnippetMutation,
) -> Result<SnippetLibrary, String> {
    let mut library = SnippetLibrary::read_from(path)?;
    if library.revision != expected_revision {
        return Err("snippets_conflict".into());
    }
    library.apply(mutation)?;
    library.write_to(path)?;
    Ok(library)
}

pub mod cmd {
    use super::*;
    use tauri::{command, Emitter};

    #[command]
    pub fn get_snippets() -> Result<SnippetLibrary, String> {
        let _guard = SNIPPETS_LOCK.lock().map_err(|error| error.to_string())?;
        SnippetLibrary::read_from(&conf::app_root().join("snippets.json"))
    }

    #[command]
    pub fn mutate_snippets(
        app: tauri::AppHandle,
        expected_revision: u64,
        mutation: SnippetMutation,
    ) -> Result<SnippetLibrary, String> {
        let guard = SNIPPETS_LOCK.lock().map_err(|error| error.to_string())?;
        let library = mutate(
            &conf::app_root().join("snippets.json"),
            expected_revision,
            mutation,
        )?;
        drop(guard);
        if let Err(error) = app.emit("snippets-changed", library.revision) {
            log::warn!("Failed to broadcast snippet changes: {error}");
        }
        Ok(library)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn snippet(id: &str) -> Snippet {
        Snippet {
            id: id.into(),
            title: " Example ".into(),
            source: "  ${value}\n\t```\n".into(),
            body: SnippetBody::Code {
                language: Some("typescript".into()),
            },
        }
    }
    #[test]
    fn round_trips_crud_and_visibility_without_changing_source() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("snippets.json");
        assert_eq!(
            SnippetLibrary::read_from(&path).unwrap(),
            SnippetLibrary::default()
        );
        let first = mutate(
            &path,
            0,
            SnippetMutation::Upsert {
                item: snippet("one"),
            },
        )
        .unwrap();
        assert_eq!(first.items[0].title, "Example");
        assert_eq!(first.items[0].source, snippet("one").source);
        assert_eq!(SnippetLibrary::read_from(&path).unwrap(), first);
        let mut changed = snippet("one");
        changed.source = "changed".into();
        mutate(&path, 1, SnippetMutation::Upsert { item: changed }).unwrap();
        assert_eq!(
            mutate(
                &path,
                2,
                SnippetMutation::BuiltinVisibility {
                    id: "builtin:math-fraction".into(),
                    hidden: true
                }
            )
            .unwrap()
            .hidden_builtin_ids
            .len(),
            1
        );
        assert!(mutate(
            &path,
            3,
            SnippetMutation::BuiltinVisibility {
                id: "builtin:math-fraction".into(),
                hidden: false
            }
        )
        .unwrap()
        .hidden_builtin_ids
        .is_empty());
        assert!(
            mutate(&path, 4, SnippetMutation::Delete { id: "one".into() })
                .unwrap()
                .items
                .is_empty()
        );
    }
    #[test]
    fn stale_window_cannot_overwrite_a_newer_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("snippets.json");
        mutate(
            &path,
            0,
            SnippetMutation::Upsert {
                item: snippet("one"),
            },
        )
        .unwrap();
        assert_eq!(
            mutate(
                &path,
                0,
                SnippetMutation::Upsert {
                    item: snippet("two")
                }
            )
            .unwrap_err(),
            "snippets_conflict"
        );
        assert_eq!(SnippetLibrary::read_from(&path).unwrap().items.len(), 1);
    }
    #[test]
    fn invalid_or_future_data_is_never_overwritten() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("snippets.json");
        for content in [
            "{broken",
            r#"{"version":2,"revision":0,"items":[],"hiddenBuiltinIds":[]}"#,
        ] {
            std::fs::write(&path, content).unwrap();
            assert!(mutate(
                &path,
                0,
                SnippetMutation::Upsert {
                    item: snippet("one")
                }
            )
            .is_err());
            assert_eq!(std::fs::read_to_string(&path).unwrap(), content);
        }
    }
    #[test]
    fn invalid_input_and_failed_write_do_not_publish_a_snapshot() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("snippets.json");
        let mut invalid = snippet("one");
        invalid.source = " \n".into();
        assert!(mutate(&path, 0, SnippetMutation::Upsert { item: invalid }).is_err());
        assert!(!path.exists());
        std::fs::create_dir(&path).unwrap();
        assert!(mutate(
            &path,
            0,
            SnippetMutation::Upsert {
                item: snippet("one")
            }
        )
        .is_err());
        assert!(path.is_dir());
    }
}
