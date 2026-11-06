use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashSet, io::Write, path::Path, sync::Mutex};
use tauri::Emitter;
use tauri_plugin_store::StoreExt;

const MAX_RECENT_FILES: usize = 200;
static HISTORY_LOCK: Mutex<u64> = Mutex::new(0);

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Mutation {
    Read,
    Visit {
        path: String,
        #[serde(rename = "afterPath")]
        after_path: Option<String>,
    },
    Clear,
    Rebase {
        path: String,
        #[serde(rename = "newPath")]
        new_path: String,
    },
    Remove {
        path: String,
    },
}

#[derive(Clone, Serialize)]
pub struct Snapshot {
    revision: u64,
    paths: Vec<String>,
}

fn windows_path(path: &str) -> bool {
    path.starts_with("\\\\")
        || (path.as_bytes().get(1) == Some(&b':')
            && matches!(path.as_bytes().get(2), Some(b'/' | b'\\'))
            && path.as_bytes().first().is_some_and(u8::is_ascii_alphabetic))
}

fn normalized(path: &str) -> String {
    let windows = windows_path(path);
    let path = if windows {
        path.replace('\\', "/")
    } else {
        path.to_owned()
    };
    let mut result = String::new();
    for character in path.chars() {
        if character != '/' || !result.ends_with('/') {
            result.push(character);
        }
    }
    while result.len() > 1 && result.ends_with('/') {
        result.pop();
    }
    if windows {
        result.to_lowercase()
    } else {
        result
    }
}

fn unique(paths: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    paths
        .into_iter()
        .filter(|path| {
            !path.trim().is_empty() && !path.contains('\0') && seen.insert(normalized(path))
        })
        .take(MAX_RECENT_FILES)
        .collect()
}

fn rebase(path: &str, root: &str, target: &str) -> Option<String> {
    let key = normalized(path);
    let root = normalized(root);
    if key == root {
        return Some(target.to_owned());
    }
    let prefix = if root.ends_with('/') {
        root
    } else {
        format!("{root}/")
    };
    key.strip_prefix(&prefix)?;
    // Slice the original spelling, rather than the case-folded identity.
    let spelling = if windows_path(path) {
        path.replace('\\', "/")
    } else {
        path.to_owned()
    };
    let parts: Vec<_> = spelling
        .split('/')
        .filter(|part| !part.is_empty())
        .collect();
    let root_parts = prefix.split('/').filter(|part| !part.is_empty()).count();
    let separator = if windows_path(target) && target.contains('\\') {
        "\\"
    } else {
        "/"
    };
    Some(format!(
        "{}{separator}{}",
        target.trim_end_matches(['/', '\\']),
        parts[root_parts..].join(separator)
    ))
}

fn apply(paths: Vec<String>, mutation: Mutation) -> Vec<String> {
    unique(match mutation {
        Mutation::Read => paths,
        Mutation::Clear => vec![],
        Mutation::Visit { path, after_path } => {
            let key = normalized(&path);
            let mut paths: Vec<_> = paths
                .into_iter()
                .filter(|entry| normalized(entry) != key)
                .collect();
            let index = after_path
                .and_then(|anchor| {
                    paths
                        .iter()
                        .position(|entry| normalized(entry) == normalized(&anchor))
                })
                .map(|index| index + 1)
                .unwrap_or(0);
            paths.insert(index, path);
            paths
        }
        Mutation::Remove { path } => paths
            .into_iter()
            .filter(|entry| rebase(entry, &path, &path).is_none())
            .collect(),
        Mutation::Rebase { path, new_path } => paths
            .into_iter()
            .map(|entry| rebase(&entry, &path, &new_path).unwrap_or(entry))
            .collect(),
    })
}

fn legacy_paths(value: &Value) -> Vec<String> {
    if let Some(paths) = value.get("recentFilePaths").and_then(Value::as_array) {
        return paths
            .iter()
            .filter_map(Value::as_str)
            .map(str::to_owned)
            .collect();
    }
    let mut paths = vec![];
    if let Some(path) = value.get("activeFilePath").and_then(Value::as_str) {
        paths.push(path.to_owned());
    }
    if let Some(opened) = value.get("openedFilePaths").and_then(Value::as_array) {
        paths.extend(opened.iter().filter_map(Value::as_str).map(str::to_owned));
    }
    if let Some(files) = value.get("files").and_then(Value::as_array) {
        paths.extend(
            files
                .iter()
                .filter_map(|file| file.get("path").and_then(Value::as_str))
                .map(str::to_owned),
        );
    }
    if let Some(layout) = value.get("editorLayout") {
        paths.extend(legacy_paths(layout));
    }
    if let Some(children) = value.get("children").and_then(Value::as_array) {
        paths.extend(children.iter().flat_map(legacy_paths));
    }
    paths
}

fn read_or_migrate(app: &tauri::AppHandle, path: &Path) -> Result<Vec<String>, String> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map(unique)
            .map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let cache = app
                .store(".markflowy_workspaces.dat")
                .map_err(|error| error.to_string())?;
            let last = cache
                .get("window-session:last-active")
                .and_then(|value| value.as_str().map(str::to_owned));
            let mut entries = cache.entries();
            entries.sort_by(|a, b| {
                (Some(&a.0) != last.as_ref(), &a.0).cmp(&(Some(&b.0) != last.as_ref(), &b.0))
            });
            Ok(unique(
                entries
                    .iter()
                    .flat_map(|(_, value)| legacy_paths(value))
                    .collect(),
            ))
        }
        Err(error) => Err(error.to_string()),
    }
}

fn write(path: &Path, paths: &[String]) -> Result<(), String> {
    let parent = path.parent().ok_or("Missing recent-file directory")?;
    std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let mut temporary =
        tempfile::NamedTempFile::new_in(parent).map_err(|error| error.to_string())?;
    temporary
        .write_all(&serde_json::to_vec(paths).map_err(|error| error.to_string())?)
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

#[tauri::command]
pub async fn recent_file_history(
    app: tauri::AppHandle,
    mutation: Mutation,
) -> Result<Snapshot, String> {
    super::startup_io::run(move || {
        let mut revision = HISTORY_LOCK.lock().map_err(|error| error.to_string())?;
        let path = super::conf::app_root().join("recent_files.json");
        let paths = read_or_migrate(&app, &path)?;
        let next = apply(paths.clone(), mutation);
        if next != paths || !path.exists() {
            write(&path, &next)?;
        }
        *revision += 1;
        let snapshot = Snapshot {
            revision: *revision,
            paths: next,
        };
        if let Err(error) = app.emit("recent-files-changed", &snapshot) {
            log::warn!("Failed to broadcast recent files: {error}");
        }
        Ok(snapshot)
    })
    .await
    .map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merges_windows_deduplicates_and_keeps_closed_files() {
        let paths = apply(
            vec!["C:\\Notes\\A.md".into()],
            Mutation::Visit {
                path: "C:\\Notes\\B.md".into(),
                after_path: None,
            },
        );
        let paths = apply(
            paths,
            Mutation::Visit {
                path: "c:/notes/a.md".into(),
                after_path: None,
            },
        );
        assert_eq!(paths, vec!["c:/notes/a.md", "C:\\Notes\\B.md"]);
        assert!(apply(paths, Mutation::Clear).is_empty());
    }

    #[test]
    fn saved_background_draft_keeps_its_place() {
        let paths = apply(
            vec!["/active.md".into(), "/older.md".into()],
            Mutation::Visit {
                path: "/saved.md".into(),
                after_path: Some("/active.md".into()),
            },
        );
        assert_eq!(paths, vec!["/active.md", "/saved.md", "/older.md"]);
    }

    #[test]
    fn rebases_descendants_and_preserves_siblings_and_case() {
        let paths = vec!["C:\\Old\\Nested\\A.md".into(), "C:\\Older\\B.md".into()];
        let paths = apply(
            paths,
            Mutation::Rebase {
                path: "c:/old".into(),
                new_path: "C:\\New".into(),
            },
        );
        assert_eq!(paths, vec!["C:\\New\\Nested\\A.md", "C:\\Older\\B.md"]);
        assert_eq!(
            apply(
                paths,
                Mutation::Remove {
                    path: "c:/new".into()
                }
            ),
            vec!["C:\\Older\\B.md"]
        );
    }

    #[test]
    fn keeps_posix_case_and_literal_backslashes() {
        assert_ne!(normalized("/notes/A.md"), normalized("/notes/a.md"));
        assert_eq!(
            rebase("/old/a\\b.md", "/old", "/new"),
            Some("/new/a\\b.md".into())
        );
        assert_eq!(
            rebase("//old///nested/A.md", "/old/", "/new"),
            Some("/new/nested/A.md".into())
        );
    }

    #[test]
    fn migration_keeps_explicitly_cleared_sessions_empty() {
        assert!(legacy_paths(
            &serde_json::json!({"recentFilePaths": [], "files": [{"path": "/old.md"}]})
        )
        .is_empty());
        assert_eq!(
            legacy_paths(
                &serde_json::json!({"files": [{"path": "/closed.md"}, {"name": "draft"}]})
            ),
            vec!["/closed.md"]
        );
    }

    #[test]
    fn history_round_trips_and_evicts_oldest_entries() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("history.json");
        let paths = unique((0..205).map(|index| format!("/notes/{index}.md")).collect());
        assert_eq!(paths.len(), MAX_RECENT_FILES);
        write(&path, &paths).unwrap();
        let saved: Vec<String> = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
        assert_eq!(saved, paths);
        write(&root.path().join("history.json"), &[]).unwrap();
        let cleared: Vec<String> =
            serde_json::from_slice(&std::fs::read(root.path().join("history.json")).unwrap())
                .unwrap();
        assert!(cleared.is_empty());
    }
}
