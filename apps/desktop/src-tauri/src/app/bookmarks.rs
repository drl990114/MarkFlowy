use super::conf;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::{self, Write},
    path::Path,
    sync::Mutex,
};

static BOOKMARKS_LOCK: Mutex<()> = Mutex::new(());
const LIBRARY_FILE: &str = "bookmark-library.json";
const LEGACY_FILE: &str = "bookmarks.json";
const MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", deny_unknown_fields)]
pub enum BookmarkTarget {
    LocalFile { path: String },
}

impl BookmarkTarget {
    fn path(&self) -> &str {
        match self {
            Self::LocalFile { path } => path,
        }
    }

    fn identity(&self) -> String {
        // Match Desktop's getPathIdentityKey, including Windows-style strings
        // on any host. This is lexical identity, not symlink/file canonicalization.
        let path = self.path();
        let bytes = path.as_bytes();
        let windows = path.starts_with("\\\\")
            || (bytes.len() >= 3
                && bytes[0].is_ascii_alphabetic()
                && bytes[1] == b':'
                && matches!(bytes[2], b'/' | b'\\'));
        let mut key = String::with_capacity(path.len());
        for character in path.chars() {
            let character = if windows && character == '\\' {
                '/'
            } else {
                character
            };
            if character != '/' || !key.ends_with('/') {
                key.push(character);
            }
        }
        if key.len() > 1 {
            key = key.trim_end_matches('/').to_owned();
        }
        if windows {
            key.to_lowercase()
        } else {
            key
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Bookmark {
    id: String,
    title: String,
    target: BookmarkTarget,
    tags: Vec<String>,
    created_at: u64,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BookmarkLibrary {
    schema_version: u32,
    revision: u64,
    items: Vec<Bookmark>,
}

impl Default for BookmarkLibrary {
    fn default() -> Self {
        Self {
            schema_version: 1,
            revision: 0,
            items: Vec::new(),
        }
    }
}

/// Persistence-only evidence: clients cannot forge or discard migration ownership.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct MigrationReceipt {
    source_sha256: String,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct BookmarkDocument {
    schema_version: u32,
    revision: u64,
    items: Vec<Bookmark>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    migration: Option<MigrationReceipt>,
}

impl Default for BookmarkDocument {
    fn default() -> Self {
        Self::from(BookmarkLibrary::default())
    }
}

impl From<BookmarkLibrary> for BookmarkDocument {
    fn from(library: BookmarkLibrary) -> Self {
        Self {
            schema_version: library.schema_version,
            revision: library.revision,
            items: library.items,
            migration: None,
        }
    }
}

impl BookmarkDocument {
    fn library(&self) -> BookmarkLibrary {
        BookmarkLibrary {
            schema_version: self.schema_version,
            revision: self.revision,
            items: self.items.clone(),
        }
    }

    fn validate(&self) -> Result<(), BookmarkError> {
        if self.schema_version != 1 {
            return Err(BookmarkError::new(
                "unsupportedVersion",
                "This bookmark library version is not supported.",
            ));
        }
        if self.revision > MAX_SAFE_INTEGER {
            return Err(BookmarkError::new("invalid", "Invalid bookmark revision."));
        }
        let mut ids = HashSet::new();
        let mut targets = HashSet::new();
        for item in &self.items {
            validate_fields(&item.title, &item.target, &item.tags)?;
            if item.id.trim().is_empty()
                || item.created_at > MAX_SAFE_INTEGER
                || !ids.insert(&item.id)
                || !targets.insert(item.target.identity())
            {
                return Err(BookmarkError::new(
                    "invalid",
                    "Bookmark IDs and targets must be unique and timestamps must be valid.",
                ));
            }
        }
        if self.migration.as_ref().is_some_and(|receipt| {
            receipt.source_sha256.len() != 64
                || !receipt
                    .source_sha256
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit())
        }) {
            return Err(BookmarkError::new(
                "invalid",
                "Invalid bookmark migration receipt.",
            ));
        }
        Ok(())
    }

    fn apply(&mut self, mutation: BookmarkMutation, now: u64) -> Result<(), BookmarkError> {
        match mutation {
            BookmarkMutation::Create { input } => {
                let title = input.title.trim().to_owned();
                let tags = normalize_tags(input.tags);
                validate_fields(&title, &input.target, &tags)?;
                if self
                    .items
                    .iter()
                    .any(|item| item.target.identity() == input.target.identity())
                {
                    return Err(BookmarkError::new(
                        "duplicateTarget",
                        "This file is already bookmarked.",
                    ));
                }
                self.items.push(Bookmark {
                    id: uuid::Uuid::new_v4().to_string(),
                    title,
                    target: input.target,
                    tags,
                    created_at: now,
                });
            }
            BookmarkMutation::Update { id, changes } => {
                let item = self
                    .items
                    .iter_mut()
                    .find(|item| item.id == id)
                    .ok_or_else(|| {
                        BookmarkError::new("notFound", "The bookmark no longer exists.")
                    })?;
                let title = changes.title.trim().to_owned();
                let tags = normalize_tags(changes.tags);
                validate_fields(&title, &item.target, &tags)?;
                item.title = title;
                item.tags = tags;
            }
            BookmarkMutation::Delete { id } => {
                let index = self
                    .items
                    .iter()
                    .position(|item| item.id == id)
                    .ok_or_else(|| {
                        BookmarkError::new("notFound", "The bookmark no longer exists.")
                    })?;
                self.items.remove(index);
            }
        }
        self.revision = self
            .revision
            .checked_add(1)
            .filter(|revision| *revision <= MAX_SAFE_INTEGER)
            .ok_or_else(|| BookmarkError::new("invalid", "Bookmark revision limit reached."))?;
        self.validate()
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BookmarkInput {
    title: String,
    target: BookmarkTarget,
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BookmarkChanges {
    title: String,
    tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum BookmarkMutation {
    Create {
        input: BookmarkInput,
    },
    Update {
        id: String,
        changes: BookmarkChanges,
    },
    Delete {
        id: String,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct BookmarkError {
    code: String,
    message: String,
}

impl BookmarkError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct BookmarkWarning {
    code: String,
    message: String,
}

#[derive(Debug, Serialize)]
pub struct BookmarkLoadResult {
    library: BookmarkLibrary,
    warning: Option<BookmarkWarning>,
}

struct LoadedDocument {
    document: BookmarkDocument,
    warning: Option<BookmarkWarning>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LegacyBookmarks {
    version: String,
    bookmarks: Vec<LegacyBookmark>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LegacyBookmark {
    id: String,
    title: String,
    path: String,
    tags: Vec<String>,
}

fn normalize_tags(tags: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    tags.into_iter()
        .map(|tag| tag.trim().to_owned())
        .filter(|tag| seen.insert(tag.clone()))
        .collect()
}

fn validate_fields(
    title: &str,
    target: &BookmarkTarget,
    tags: &[String],
) -> Result<(), BookmarkError> {
    let mut unique_tags = HashSet::new();
    if title.trim().is_empty()
        || !Path::new(target.path()).is_absolute()
        || target.path().contains('\0')
        || tags
            .iter()
            .any(|tag| tag.trim().is_empty() || !unique_tags.insert(tag))
    {
        return Err(BookmarkError::new(
            "invalid",
            "Bookmarks require a title, an absolute file path and unique nonempty tags.",
        ));
    }
    Ok(())
}

fn read_regular(path: &Path) -> Result<Option<Vec<u8>>, BookmarkError> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(BookmarkError::new("readFailed", error.to_string())),
        Ok(metadata) if !metadata.file_type().is_file() => {
            return Err(BookmarkError::new(
                "readFailed",
                "Bookmark storage must be a regular file.",
            ));
        }
        Ok(_) => {}
    }
    fs::read(path)
        .map(Some)
        .map_err(|error| BookmarkError::new("readFailed", error.to_string()))
}

fn read_document(path: &Path) -> Result<Option<BookmarkDocument>, BookmarkError> {
    let Some(bytes) = read_regular(path)? else {
        return Ok(None);
    };
    // Inspect the version first, including future documents with unfamiliar fields.
    let value: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|error| BookmarkError::new("invalid", error.to_string()))?;
    if value
        .get("schemaVersion")
        .and_then(serde_json::Value::as_u64)
        .is_some_and(|version| version != 1)
    {
        return Err(BookmarkError::new(
            "unsupportedVersion",
            "This bookmark library version is not supported.",
        ));
    }
    let document: BookmarkDocument = serde_json::from_value(value)
        .map_err(|error| BookmarkError::new("invalid", error.to_string()))?;
    document.validate()?;
    Ok(Some(document))
}

fn sync_parent(path: &Path) -> io::Result<()> {
    #[cfg(unix)]
    {
        let parent = path
            .parent()
            .ok_or_else(|| io::Error::other("Missing bookmark directory."))?;
        fs::File::open(parent)?.sync_all()?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

fn write_document(path: &Path, document: &BookmarkDocument, create_new: bool) -> io::Result<()> {
    let directory = path
        .parent()
        .ok_or_else(|| io::Error::other("Missing bookmark directory."))?;
    fs::create_dir_all(directory)?;
    let content = serde_json::to_vec_pretty(document).map_err(io::Error::other)?;
    let mut temporary = tempfile::Builder::new()
        .prefix(".bookmark-library-")
        .tempfile_in(directory)?;
    if let Ok(metadata) = fs::metadata(path) {
        temporary
            .as_file()
            .set_permissions(metadata.permissions())?;
    }
    temporary.write_all(&content)?;
    temporary.as_file().sync_all()?;
    if create_new {
        temporary
            .persist_noclobber(path)
            .map_err(|error| error.error)?;
    } else {
        temporary.persist(path).map_err(|error| error.error)?;
    }
    sync_parent(path)
}

fn source_hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn migrate_legacy(bytes: &[u8], now: u64) -> Result<BookmarkDocument, BookmarkError> {
    let value: serde_json::Value = serde_json::from_slice(bytes)
        .map_err(|error| BookmarkError::new("invalid", error.to_string()))?;
    if value
        .get("version")
        .and_then(serde_json::Value::as_str)
        .is_some_and(|version| version != "0.0.1")
    {
        return Err(BookmarkError::new(
            "unsupportedVersion",
            "This legacy bookmark version is not supported.",
        ));
    }
    let legacy: LegacyBookmarks = serde_json::from_value(value)
        .map_err(|error| BookmarkError::new("invalid", error.to_string()))?;
    if legacy.version != "0.0.1" {
        return Err(BookmarkError::new(
            "unsupportedVersion",
            "This legacy bookmark version is not supported.",
        ));
    }
    let document = BookmarkDocument {
        schema_version: 1,
        revision: 1,
        items: legacy
            .bookmarks
            .into_iter()
            .map(|item| Bookmark {
                id: item.id,
                title: item.title,
                target: BookmarkTarget::LocalFile { path: item.path },
                tags: item.tags,
                created_at: now,
            })
            .collect(),
        migration: Some(MigrationReceipt {
            source_sha256: source_hash(bytes),
        }),
    };
    document.validate()?;
    Ok(document)
}

fn cleanup_warning(code: &str, message: impl Into<String>) -> Option<BookmarkWarning> {
    Some(BookmarkWarning {
        code: code.into(),
        message: message.into(),
    })
}

fn cleanup_legacy(
    directory: &Path,
    document: &BookmarkDocument,
    remove: impl FnOnce(&Path) -> io::Result<()>,
) -> Option<BookmarkWarning> {
    let legacy_path = directory.join(LEGACY_FILE);
    let bytes = match read_regular(&legacy_path) {
        Ok(None) => return None,
        Ok(Some(bytes)) => bytes,
        Err(error) => return cleanup_warning("cleanupFailed", error.message),
    };
    let matches_receipt = document
        .migration
        .as_ref()
        .is_some_and(|receipt| receipt.source_sha256 == source_hash(&bytes));
    if !matches_receipt {
        return cleanup_warning(
            "legacyConflict",
            "The legacy bookmark file has not been migrated or has changed. Both files were preserved.",
        );
    }
    // A previous run may have published the new file but failed to sync its directory.
    if let Err(error) = sync_parent(&directory.join(LIBRARY_FILE)) {
        return cleanup_warning("cleanupFailed", error.to_string());
    }
    // Recheck immediately before deletion; the process lock cannot prevent external edits.
    match read_regular(&legacy_path) {
        Ok(None) => return None,
        Ok(Some(current)) if current == bytes => {}
        Ok(Some(_)) => {
            return cleanup_warning(
                "legacyConflict",
                "The legacy bookmark file changed during cleanup. It was preserved.",
            )
        }
        Err(error) => return cleanup_warning("cleanupFailed", error.message),
    }
    if let Err(error) = remove(&legacy_path).and_then(|_| sync_parent(&legacy_path)) {
        return cleanup_warning("cleanupFailed", error.to_string());
    }
    None
}

fn load_document(directory: &Path, now: u64) -> Result<LoadedDocument, BookmarkError> {
    let path = directory.join(LIBRARY_FILE);
    if let Some(document) = read_document(&path)? {
        let warning = cleanup_legacy(directory, &document, |path| fs::remove_file(path));
        return Ok(LoadedDocument { document, warning });
    }
    let Some(bytes) = read_regular(&directory.join(LEGACY_FILE))? else {
        return Ok(LoadedDocument {
            document: BookmarkDocument::default(),
            warning: None,
        });
    };
    let migrated = migrate_legacy(&bytes, now)?;
    match write_document(&path, &migrated, true) {
        Ok(()) => {}
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            // Another publisher won. Never overwrite it with the migration snapshot.
            let document = read_document(&path)?.ok_or_else(|| {
                BookmarkError::new(
                    "readFailed",
                    "The bookmark library disappeared during migration.",
                )
            })?;
            let warning = cleanup_legacy(directory, &document, |path| fs::remove_file(path));
            return Ok(LoadedDocument { document, warning });
        }
        Err(error) => return Err(BookmarkError::new("writeFailed", error.to_string())),
    }
    let verified = read_document(&path)?.ok_or_else(|| {
        BookmarkError::new(
            "readFailed",
            "The migrated bookmark library could not be read back.",
        )
    })?;
    if verified != migrated {
        return Err(BookmarkError::new(
            "writeFailed",
            "The migrated bookmark library failed verification. The legacy file was preserved.",
        ));
    }
    let warning = cleanup_legacy(directory, &verified, |path| fs::remove_file(path));
    Ok(LoadedDocument {
        document: verified,
        warning,
    })
}

fn mutate_document(
    directory: &Path,
    expected_revision: u64,
    mutation: BookmarkMutation,
    now: u64,
) -> Result<BookmarkLibrary, BookmarkError> {
    let mut document = load_document(directory, now)?.document;
    if document.revision != expected_revision {
        return Err(BookmarkError::new(
            "conflict",
            "Bookmarks changed in another window. Reload before saving.",
        ));
    }
    document.apply(mutation, now)?;
    write_document(&directory.join(LIBRARY_FILE), &document, false)
        .map_err(|error| BookmarkError::new("writeFailed", error.to_string()))?;
    Ok(document.library())
}

fn current_time() -> Result<u64, BookmarkError> {
    u64::try_from(chrono::Utc::now().timestamp_millis())
        .map_err(|_| BookmarkError::new("invalid", "The system clock is invalid."))
}

pub mod cmd {
    use super::*;
    use tauri::{command, Emitter};

    #[command]
    pub fn get_bookmark_library() -> Result<BookmarkLoadResult, BookmarkError> {
        let _guard = BOOKMARKS_LOCK
            .lock()
            .map_err(|error| BookmarkError::new("readFailed", error.to_string()))?;
        let loaded = load_document(&conf::app_root(), current_time()?)?;
        Ok(BookmarkLoadResult {
            library: loaded.document.library(),
            warning: loaded.warning,
        })
    }

    #[command]
    pub fn mutate_bookmark_library(
        app: tauri::AppHandle,
        expected_revision: u64,
        mutation: BookmarkMutation,
    ) -> Result<BookmarkLibrary, BookmarkError> {
        let guard = BOOKMARKS_LOCK
            .lock()
            .map_err(|error| BookmarkError::new("writeFailed", error.to_string()))?;
        let library = mutate_document(
            &conf::app_root(),
            expected_revision,
            mutation,
            current_time()?,
        )?;
        drop(guard);
        if let Err(error) = app.emit("bookmark-library-changed", library.revision) {
            log::warn!("Failed to broadcast bookmark changes: {error}");
        }
        Ok(library)
    }
}

#[cfg(test)]
#[path = "bookmarks_tests.rs"]
mod tests;
