use anyhow::Result as AnyResult;
use chrono::{DateTime, Local};
use mf_utils::is_supported_file_name;
use natural_sort_rs::Natural;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
#[cfg(target_os = "macos")]
use std::collections::HashSet;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::task_system::error::SystemError;

#[cfg(target_os = "macos")]
use core_foundation::base::TCFType;
#[cfg(target_os = "macos")]
use core_foundation::url::CFURL;
#[cfg(target_os = "macos")]
use core_foundation_sys::url::{
    CFURLStartAccessingSecurityScopedResource, CFURLStopAccessingSecurityScopedResource,
};

#[cfg(target_os = "macos")]
lazy_static::lazy_static! {
    static ref ACTIVE_SECURITY_SCOPES: Mutex<HashSet<PathBuf>> = Mutex::new(HashSet::new());
    /// 工作区根路径的安全范围，打开文件夹时预激活并持续保持
    static ref WORKSPACE_ROOT_SCOPE: Mutex<Option<PathBuf>> = Mutex::new(None);
}

lazy_static::lazy_static! {
    static ref FILE_WRITE_MUTEX: Mutex<()> = Mutex::new(());
    static ref FILE_WRITE_GENERATIONS: Mutex<HashMap<String, u64>> = Mutex::new(HashMap::new());
}

#[cfg(target_os = "macos")]
fn path_has_active_security_scope(path: &Path) -> bool {
    ACTIVE_SECURITY_SCOPES
        .lock()
        .map(|scopes| scopes.iter().any(|scope| path.starts_with(scope)))
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn start_accessing_security_scoped_resource(path: &Path) -> bool {
    let path_str = match path.to_str() {
        Some(s) => s,
        None => return false,
    };

    let cf_url = CFURL::from_path(path_str, true);
    match cf_url {
        Some(url) => unsafe {
            CFURLStartAccessingSecurityScopedResource(url.as_concrete_TypeRef()) != 0
        },
        None => false,
    }
}

#[cfg(target_os = "macos")]
fn stop_accessing_security_scoped_resource(path: &Path) {
    let path_str = match path.to_str() {
        Some(s) => s,
        None => return,
    };

    let cf_url = CFURL::from_path(path_str, true);
    if let Some(url) = cf_url {
        unsafe {
            CFURLStopAccessingSecurityScopedResource(url.as_concrete_TypeRef());
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn start_accessing_security_scoped_resource(_path: &Path) -> bool {
    true
}

#[cfg(not(target_os = "macos"))]
fn stop_accessing_security_scoped_resource(_path: &Path) {}

#[cfg(target_os = "macos")]
fn security_scope_key(path: &Path) -> PathBuf {
    path.canonicalize().unwrap_or_else(|_| path.to_path_buf())
}

#[cfg(target_os = "macos")]
pub fn acquire_security_scope(path: &Path) -> bool {
    let key = security_scope_key(path);

    if path_has_active_security_scope(&key) {
        return true;
    }

    let restored_scope = security_bookmark::restore_access_for_path(path);
    let has_access = restored_scope.is_some() || start_accessing_security_scoped_resource(path);

    if has_access {
        if let Ok(mut scopes) = ACTIVE_SECURITY_SCOPES.lock() {
            scopes.insert(restored_scope.unwrap_or(key));
        }
    }

    has_access
}

#[cfg(not(target_os = "macos"))]
pub fn acquire_security_scope(_path: &Path) -> bool {
    true
}

/// 主动确保工作区根路径的安全范围已激活（读文件前调用，避免 PermissionDenied 重试）
#[cfg(target_os = "macos")]
fn ensure_workspace_scope_active(file_path: &Path) {
    // 快速检查：路径是否已在活跃的 scope 下
    if path_has_active_security_scope(&security_scope_key(file_path)) {
        return;
    }
    // 检查工作区根范围是否覆盖此路径
    if let Ok(root) = WORKSPACE_ROOT_SCOPE.lock() {
        if let Some(ref root_path) = *root {
            if file_path.starts_with(root_path) {
                // 根范围应已激活，尝试重新 acquire 以防失效
                let _ = acquire_security_scope(root_path);
                return;
            }
        }
    }
    // 兜底：直接对文件路径 acquire
    acquire_security_scope(file_path);
}

#[cfg(not(target_os = "macos"))]
fn ensure_workspace_scope_active(_file_path: &Path) {}

#[cfg(target_os = "macos")]
pub fn release_security_scope(path: &Path) -> bool {
    let key = security_scope_key(path);

    let should_release = ACTIVE_SECURITY_SCOPES
        .lock()
        .map(|mut scopes| scopes.remove(&key))
        .unwrap_or(false);

    if should_release {
        stop_accessing_security_scoped_resource(&key);
    }

    should_release
}

#[cfg(not(target_os = "macos"))]
pub fn release_security_scope(_path: &Path) -> bool {
    true
}

#[cfg(target_os = "macos")]
pub fn release_all_security_scopes() -> bool {
    let scopes = ACTIVE_SECURITY_SCOPES
        .lock()
        .map(|mut scopes| scopes.drain().collect::<Vec<_>>())
        .unwrap_or_default();

    for path in scopes {
        stop_accessing_security_scoped_resource(&path);
    }

    true
}

#[cfg(not(target_os = "macos"))]
pub fn release_all_security_scopes() -> bool {
    true
}

#[cfg(target_os = "macos")]
mod security_bookmark {
    use core_foundation::base::TCFType;
    use core_foundation::data::CFData;
    use core_foundation::url::CFURL;
    use core_foundation_sys::base::kCFAllocatorDefault;
    use core_foundation_sys::url::{
        kCFURLBookmarkCreationWithSecurityScope, kCFURLBookmarkResolutionWithSecurityScope,
        CFURLCreateBookmarkData, CFURLCreateByResolvingBookmarkData,
        CFURLStartAccessingSecurityScopedResource,
    };
    use std::fs;
    use std::io::{Read, Write};
    use std::path::PathBuf;
    use std::sync::Mutex;

    lazy_static::lazy_static! {
        static ref BOOKMARKS_CACHE: Mutex<Option<std::collections::HashMap<String, Vec<u8>>>> = Mutex::new(None);
    }

    pub fn create_security_scoped_bookmark(path: &std::path::Path) -> Option<Vec<u8>> {
        let path_str = path.to_str()?;
        let cf_url = CFURL::from_path(path_str, true)?;

        unsafe {
            let mut error: core_foundation_sys::error::CFErrorRef = std::ptr::null_mut();
            let bookmark_data = CFURLCreateBookmarkData(
                kCFAllocatorDefault,
                cf_url.as_concrete_TypeRef(),
                kCFURLBookmarkCreationWithSecurityScope,
                std::ptr::null(),
                std::ptr::null(),
                &mut error,
            );

            if bookmark_data.is_null() {
                return None;
            }

            let cf_data = CFData::wrap_under_create_rule(bookmark_data);
            let data = cf_data.to_vec();
            Some(data)
        }
    }

    pub fn resolve_security_scoped_bookmark(bookmark_data: &[u8]) -> Option<std::path::PathBuf> {
        unsafe {
            let cf_data = CFData::from_buffer(bookmark_data);
            let mut error: core_foundation_sys::error::CFErrorRef = std::ptr::null_mut();
            let mut is_stale: core_foundation_sys::base::Boolean = 0;

            let cf_url = CFURLCreateByResolvingBookmarkData(
                kCFAllocatorDefault,
                cf_data.as_concrete_TypeRef(),
                kCFURLBookmarkResolutionWithSecurityScope,
                std::ptr::null(),
                std::ptr::null(),
                &mut is_stale,
                &mut error,
            );

            if cf_url.is_null() {
                return None;
            }

            let url = CFURL::wrap_under_create_rule(cf_url);

            CFURLStartAccessingSecurityScopedResource(url.as_concrete_TypeRef());

            let path_str = url.get_string().to_string();
            let path_str = urlencoding::decode(&path_str).ok()?;
            let path_str = path_str.strip_prefix("file://").unwrap_or(&path_str);

            Some(std::path::PathBuf::from(path_str))
        }
    }

    pub fn get_bookmark_storage_path() -> Option<PathBuf> {
        use etcetera::app_strategy::{AppStrategy, AppStrategyArgs};

        let args = AppStrategyArgs {
            top_level_domain: "com".to_string(),
            author: "toolsetlink".to_string(),
            app_name: "MarkFlowy".to_string(),
        };

        let app_support = match etcetera::app_strategy::choose_native_strategy(args) {
            Ok(strategy) => strategy.data_dir(),
            Err(_) => return None,
        };

        if !app_support.exists() {
            fs::create_dir_all(&app_support).ok()?;
        }

        Some(app_support.join("bookmarks.bin"))
    }

    pub fn save_bookmark(path: &std::path::Path) -> bool {
        let bookmark_data = match create_security_scoped_bookmark(path) {
            Some(data) => data,
            None => return false,
        };

        let storage_path = match get_bookmark_storage_path() {
            Some(p) => p,
            None => return false,
        };

        let mut bookmarks = load_all_bookmarks();
        let path_str = path.to_string_lossy().to_string();
        bookmarks.insert(path_str, bookmark_data);

        let mut file = match fs::File::create(&storage_path) {
            Ok(f) => f,
            Err(_) => return false,
        };

        let serialized = match bincode::serialize(&bookmarks) {
            Ok(data) => data,
            Err(_) => return false,
        };
        if file.write_all(&serialized).is_ok() {
            if let Ok(mut cache) = BOOKMARKS_CACHE.lock() {
                *cache = Some(bookmarks);
            }
            true
        } else {
            false
        }
    }

    pub fn load_all_bookmarks() -> std::collections::HashMap<String, Vec<u8>> {
        if let Ok(cache) = BOOKMARKS_CACHE.lock() {
            if let Some(bookmarks) = cache.as_ref() {
                return bookmarks.clone();
            }
        }

        let storage_path = match get_bookmark_storage_path() {
            Some(p) => p,
            None => return std::collections::HashMap::new(),
        };

        if !storage_path.exists() {
            return std::collections::HashMap::new();
        }

        let mut file = match fs::File::open(&storage_path) {
            Ok(f) => f,
            Err(_) => return std::collections::HashMap::new(),
        };

        let mut data = Vec::new();
        if file.read_to_end(&mut data).is_err() {
            return std::collections::HashMap::new();
        }

        let bookmarks: std::collections::HashMap<String, Vec<u8>> =
            bincode::deserialize(&data).unwrap_or_default();
        if let Ok(mut cache) = BOOKMARKS_CACHE.lock() {
            *cache = Some(bookmarks.clone());
        }
        bookmarks
    }

    pub fn restore_access_for_path(path: &std::path::Path) -> Option<std::path::PathBuf> {
        let bookmarks = load_all_bookmarks();
        let path_str = path.to_string_lossy();

        bookmarks
            .iter()
            .filter(|(bookmark_path, _)| {
                path_str.as_ref() == bookmark_path.as_str()
                    || path_str
                        .as_ref()
                        .starts_with(&format!("{}/", bookmark_path.trim_end_matches('/')))
            })
            .max_by_key(|(bookmark_path, _)| bookmark_path.len())
            .and_then(|(_, bookmark_data)| resolve_security_scoped_bookmark(bookmark_data))
    }
}

// #[warn(dead_code)]
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileInfo {
    name: String,
    kind: String,
    path: String,
    children: Option<Vec<FileInfo>>,
    ext: String,
}

#[derive(Serialize, Deserialize)]
pub struct Post {
    title: String,
    created: String,
    link: String,
    description: String,
    content: String,
    author: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum FileResultCode {
    Success = 0,
    NotFound = -1,
    PermissionDenied = -2,
    InvalidPath = -3,
    Binary = -4,
    UnknownError = -99,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileResult {
    pub code: FileResultCode,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ConditionalWriteStatus {
    Success,
    Conflict,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConditionalWriteResult {
    pub status: ConditionalWriteStatus,
    pub revision: String,
}

pub fn read_directory(dir_path: &str) -> Result<Vec<FileInfo>, FileResultCode> {
    read_directory_single_level(dir_path)
}

pub fn read_directory_single_level(dir_path: &str) -> Result<Vec<FileInfo>, FileResultCode> {
    let new_path = Path::new(dir_path);
    acquire_security_scope(new_path);

    let paths = match fs::read_dir(new_path) {
        Ok(paths) => paths,
        Err(e) => {
            return match e.kind() {
                std::io::ErrorKind::NotFound => Err(FileResultCode::NotFound),
                std::io::ErrorKind::PermissionDenied => Err(FileResultCode::PermissionDenied),
                _ => Err(FileResultCode::UnknownError),
            };
        }
    };

    let mut files: Vec<FileInfo> = Vec::new();

    for path in paths {
        let path_unwrap = match path {
            Ok(p) => p,
            Err(_) => continue,
        };

        let meta = match path_unwrap.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let mut kind = String::from("file");
        let mut children: Option<Vec<FileInfo>> = None;

        let filename = match path_unwrap.file_name().into_string() {
            Ok(str) => str,
            Err(_) => continue,
        };

        let file_path = new_path.join(filename.clone());
        let ext = file_path.extension();
        let file_ext = match ext {
            Some(ext) => ext.to_str().unwrap_or("").to_string(),
            None => String::from(""),
        };

        if meta.is_dir() {
            kind = String::from("dir");
            children = Some(Vec::new());
        }

        let new_file_info = FileInfo {
            name: filename,
            kind,
            path: file_path.to_str().unwrap_or("").to_string(),
            children,
            ext: file_ext.into(),
        };

        if is_supported_file_name(&new_file_info.name) || meta.is_dir() {
            files.push(new_file_info);
        }
    }

    sort_files_by_kind_and_name(&mut files);
    Ok(files)
}

pub fn sort_files_by_kind_and_name(files: &mut Vec<FileInfo>) {
    use std::cmp::Ordering;

    files.sort_by(|a, b| {
        // 1. 首先按类型排序（文件夹优先）
        if a.kind != b.kind {
            return if a.kind == "dir" {
                Ordering::Less
            } else {
                Ordering::Greater
            };
        }

        if Natural::str(a.name.clone()) < Natural::str(b.name.clone()) {
            Ordering::Less
        } else if Natural::str(a.name.clone()) > Natural::str(b.name.clone()) {
            Ordering::Greater
        } else {
            Ordering::Equal
        }
    });
}

pub fn files_to_json(files: Vec<FileInfo>) -> FileResult {
    match serde_json::to_string(&files) {
        Ok(content) => FileResult {
            code: FileResultCode::Success,
            content,
        },
        Err(e) => FileResult {
            code: FileResultCode::UnknownError,
            content: format!("Failed to serialize files: {}", e),
        },
    }
}

pub fn filter_files_by_exclude_patterns(
    files: Vec<FileInfo>,
    root_path: &str,
    patterns: &str,
) -> Vec<FileInfo> {
    if patterns.trim().is_empty() {
        return files;
    }

    let matcher = mf_file_search::exclude::build_exclude_matcher(root_path, patterns);
    filter_files_with_exclude_matcher(files, &matcher)
}

fn filter_files_with_exclude_matcher(
    files: Vec<FileInfo>,
    matcher: &mf_file_search::exclude::ExcludeMatcher,
) -> Vec<FileInfo> {
    files
        .into_iter()
        .filter_map(|mut file| {
            let is_dir = file.kind == "dir";
            if mf_file_search::exclude::is_excluded_path(matcher, &file.path, is_dir) {
                return None;
            }

            if let Some(children) = file.children.take() {
                file.children = Some(filter_files_with_exclude_matcher(children, matcher));
            }

            Some(file)
        })
        .collect()
}

fn decode_utf16_bytes(bytes: &[u8], little_endian: bool) -> Result<String, String> {
    if bytes.len() % 2 != 0 {
        return Err(String::from("UTF-16 content has an odd byte length"));
    }

    let code_units = bytes.chunks_exact(2).map(|chunk| {
        if little_endian {
            u16::from_le_bytes([chunk[0], chunk[1]])
        } else {
            u16::from_be_bytes([chunk[0], chunk[1]])
        }
    });

    std::char::decode_utf16(code_units)
        .map(|result| result.map_err(|e| format!("Invalid UTF-16 content: {}", e)))
        .collect()
}

fn decode_text_bytes(bytes: Vec<u8>) -> Result<String, FileResult> {
    if bytes.is_empty() {
        return Ok(String::new());
    }

    if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        return String::from_utf8(bytes[3..].to_vec()).map_err(|e| FileResult {
            code: FileResultCode::UnknownError,
            content: format!("Unsupported UTF-8 content: {}", e),
        });
    }

    if bytes.starts_with(&[0xFF, 0xFE]) {
        return decode_utf16_bytes(&bytes[2..], true).map_err(|e| FileResult {
            code: FileResultCode::UnknownError,
            content: e,
        });
    }

    if bytes.starts_with(&[0xFE, 0xFF]) {
        return decode_utf16_bytes(&bytes[2..], false).map_err(|e| FileResult {
            code: FileResultCode::UnknownError,
            content: e,
        });
    }

    let mut could_be_utf16_le = true;
    let mut could_be_utf16_be = true;
    let mut contains_zero_byte = false;

    for (i, byte) in bytes.iter().take(512).enumerate() {
        let is_endian = i % 2 == 1;
        let is_zero_byte = *byte == 0;

        if is_zero_byte {
            contains_zero_byte = true;
        }

        if could_be_utf16_le && ((is_endian && !is_zero_byte) || (!is_endian && is_zero_byte)) {
            could_be_utf16_le = false;
        }

        if could_be_utf16_be && ((is_endian && is_zero_byte) || (!is_endian && !is_zero_byte)) {
            could_be_utf16_be = false;
        }

        if is_zero_byte && !could_be_utf16_le && !could_be_utf16_be {
            break;
        }
    }

    if contains_zero_byte {
        if could_be_utf16_le {
            return decode_utf16_bytes(&bytes, true).map_err(|e| FileResult {
                code: FileResultCode::UnknownError,
                content: e,
            });
        }

        if could_be_utf16_be {
            return decode_utf16_bytes(&bytes, false).map_err(|e| FileResult {
                code: FileResultCode::UnknownError,
                content: e,
            });
        }

        return Err(FileResult {
            code: FileResultCode::Binary,
            content: String::from("File seems to be binary and cannot be opened as text"),
        });
    }

    String::from_utf8(bytes).map_err(|e| FileResult {
        code: FileResultCode::UnknownError,
        content: format!("Unsupported text encoding: {}", e),
    })
}

pub fn read_file(path: &str) -> FileResult {
    match fs::read(path) {
        Ok(bytes) => match decode_text_bytes(bytes) {
            Ok(content) => FileResult {
                code: FileResultCode::Success,
                content,
            },
            Err(result) => result,
        },
        Err(e) => {
            let code = match e.kind() {
                std::io::ErrorKind::NotFound => FileResultCode::NotFound,
                std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                _ => FileResultCode::UnknownError,
            };
            FileResult {
                code,
                content: format!("Failed to read file: {}", e),
            }
        }
    }
}

pub async fn read_file_async(path: &str) -> FileResult {
    let file_path = Path::new(path);

    // 主动确保安全范围已激活，避免 PermissionDenied → 重试 的双倍 I/O 路径
    ensure_workspace_scope_active(file_path);

    let read_result = tokio::fs::read(file_path).await;

    match read_result {
        Ok(bytes) => match decode_text_bytes(bytes) {
            Ok(content) => FileResult {
                code: FileResultCode::Success,
                content,
            },
            Err(result) => result,
        },
        Err(e) => {
            // 兜底：主动检查后仍然失败，再尝试一次 acquire 后重试
            if e.kind() == std::io::ErrorKind::PermissionDenied {
                acquire_security_scope(file_path);
                if let Ok(bytes) = tokio::fs::read(file_path).await {
                    return match decode_text_bytes(bytes) {
                        Ok(content) => FileResult {
                            code: FileResultCode::Success,
                            content,
                        },
                        Err(result) => result,
                    };
                }
            }

            let code = match e.kind() {
                std::io::ErrorKind::NotFound => FileResultCode::NotFound,
                std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                _ => FileResultCode::UnknownError,
            };
            FileResult {
                code,
                content: format!("Failed to read file: {}", e),
            }
        }
    }
}

pub fn is_text_file(path: &str) -> bool {
    use std::io::Read;
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut reader = std::io::BufReader::new(file);
    let mut buf = [0u8; 8192];
    let n = match reader.read(&mut buf) {
        Ok(n) => n,
        Err(_) => return false,
    };
    if n == 0 {
        return true;
    }
    let chunk = &buf[..n];
    if chunk.contains(&0) {
        return false;
    }
    std::str::from_utf8(chunk).is_ok()
}

fn write_file_unlocked(path: &str, content: &str) -> FileResult {
    let file_path = Path::new(path);
    match fs::write(file_path, content) {
        Ok(()) => FileResult {
            code: FileResultCode::Success,
            content: String::from("File written successfully"),
        },
        Err(e) => {
            let code = match e.kind() {
                std::io::ErrorKind::NotFound => FileResultCode::NotFound,
                std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                _ => FileResultCode::UnknownError,
            };
            FileResult {
                code,
                content: format!("Failed to write file: {}", e),
            }
        }
    }
}

// update file and create new file
pub fn write_file(path: &str, content: &str) -> FileResult {
    let Ok(_guard) = FILE_WRITE_MUTEX.lock() else {
        return FileResult {
            code: FileResultCode::UnknownError,
            content: String::from("File write lock is unavailable"),
        };
    };

    let result = write_file_unlocked(path, content);
    if result.code == FileResultCode::Success {
        let _ = bump_file_write_generation(Path::new(path));
    }
    result
}

fn revision_for_content(content: &[u8]) -> String {
    let digest = Sha256::digest(content);
    format!("sha256:{digest:x}")
}

fn path_revision_key(path: &Path) -> String {
    let absolute_path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map(|current_dir| current_dir.join(path))
            .unwrap_or_else(|_| path.to_path_buf())
    };
    let resolved_parent = absolute_path
        .parent()
        .and_then(|parent| fs::canonicalize(parent).ok())
        .unwrap_or_else(|| {
            absolute_path
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .to_path_buf()
        });
    let file_name = absolute_path.file_name().unwrap_or_default();
    format!("path:{}", resolved_parent.join(file_name).to_string_lossy())
}

fn revision_key(path: &Path, metadata: Option<&fs::Metadata>) -> String {
    #[cfg(unix)]
    if let Some(metadata) = metadata {
        use std::os::unix::fs::MetadataExt;
        return format!("file:{}:{}", metadata.dev(), metadata.ino());
    }

    path_revision_key(path)
}

fn file_write_revision_unlocked(path: &Path) -> AnyResult<String> {
    match fs::read(path) {
        Ok(content) => {
            let metadata = fs::metadata(path)?;
            let modified_nanos = metadata
                .modified()
                .ok()
                .and_then(|modified| modified.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|duration| duration.as_nanos())
                .unwrap_or_default();

            #[cfg(unix)]
            {
                use std::os::unix::fs::MetadataExt;
                let fingerprint = format!(
                    "existing:{}:{}:{}:{}:{}",
                    metadata.dev(),
                    metadata.ino(),
                    metadata.len(),
                    modified_nanos,
                    revision_for_content(&content)
                );
                let path_key = path_revision_key(path);
                let file_key = revision_key(path, Some(&metadata));
                let generations = FILE_WRITE_GENERATIONS
                    .lock()
                    .map_err(|_| anyhow::anyhow!("File revision lock is unavailable"))?;
                let path_generation = generations.get(&path_key).copied().unwrap_or_default();
                let file_generation = generations.get(&file_key).copied().unwrap_or_default();
                Ok(format!(
                    "{fingerprint}:path-generation:{path_generation}:file-generation:{file_generation}"
                ))
            }

            #[cfg(not(unix))]
            {
                let fingerprint = format!(
                    "existing:{}:{}:{}",
                    metadata.len(),
                    modified_nanos,
                    revision_for_content(&content)
                );
                let path_key = path_revision_key(path);
                let file_key = revision_key(path, Some(&metadata));
                let generations = FILE_WRITE_GENERATIONS
                    .lock()
                    .map_err(|_| anyhow::anyhow!("File revision lock is unavailable"))?;
                let path_generation = generations.get(&path_key).copied().unwrap_or_default();
                let file_generation = generations.get(&file_key).copied().unwrap_or_default();
                Ok(format!(
                    "{fingerprint}:path-generation:{path_generation}:file-generation:{file_generation}"
                ))
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let generation = FILE_WRITE_GENERATIONS
                .lock()
                .map_err(|_| anyhow::anyhow!("File revision lock is unavailable"))?
                .get(&revision_key(path, None))
                .copied()
                .unwrap_or_default();
            Ok(format!("missing:generation:{generation}"))
        }
        Err(error) => Err(error.into()),
    }
}

pub fn get_file_write_revision(path: &Path) -> AnyResult<String> {
    let _guard = FILE_WRITE_MUTEX
        .lock()
        .map_err(|_| anyhow::anyhow!("File write lock is unavailable"))?;
    file_write_revision_unlocked(path)
}

fn bump_file_write_generation(path: &Path) -> AnyResult<()> {
    let metadata = fs::metadata(path).ok();
    let path_key = path_revision_key(path);
    let file_key = revision_key(path, metadata.as_ref());
    let mut generations = FILE_WRITE_GENERATIONS
        .lock()
        .map_err(|_| anyhow::anyhow!("File revision lock is unavailable"))?;
    let path_generation = generations.entry(path_key.clone()).or_default();
    *path_generation = path_generation.wrapping_add(1);
    if file_key != path_key {
        let file_generation = generations.entry(file_key).or_default();
        *file_generation = file_generation.wrapping_add(1);
    }
    Ok(())
}

fn atomic_write_file_unlocked(path: &Path, content: &[u8]) -> AnyResult<()> {
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let mut temp_file_builder = tempfile::Builder::new();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        temp_file_builder.permissions(fs::Permissions::from_mode(0o666));
    }
    let mut temp_file = temp_file_builder.tempfile_in(parent)?;

    if let Ok(metadata) = fs::metadata(path) {
        temp_file
            .as_file()
            .set_permissions(metadata.permissions())?;
    }

    temp_file.write_all(content)?;
    temp_file.as_file_mut().sync_all()?;
    temp_file.persist(path).map_err(|error| error.error)?;

    #[cfg(unix)]
    fs::File::open(parent)?.sync_all()?;

    Ok(())
}

fn write_file_in_place_unlocked(path: &Path, content: &[u8], create: bool) -> AnyResult<()> {
    let mut options = fs::OpenOptions::new();
    options.write(true).truncate(true).create(create);
    let mut file = options.open(path)?;
    file.write_all(content)?;
    file.sync_all()?;
    Ok(())
}

pub fn conditional_write_file(
    path: &Path,
    content: &[u8],
    expected_revision: &str,
) -> AnyResult<ConditionalWriteResult> {
    let _guard = FILE_WRITE_MUTEX
        .lock()
        .map_err(|_| anyhow::anyhow!("File write lock is unavailable"))?;
    let current_revision = file_write_revision_unlocked(path)?;

    if current_revision != expected_revision {
        return Ok(ConditionalWriteResult {
            status: ConditionalWriteStatus::Conflict,
            revision: current_revision,
        });
    }

    match fs::metadata(path) {
        Ok(_) => {
            // Preserve the inode, hardlinks, xattrs, and the existing `fs::write`
            // behavior of following symlinks. The process mutex keeps CAS atomic.
            write_file_in_place_unlocked(path, content, false)?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            let is_dangling_symlink = fs::symlink_metadata(path)
                .map(|metadata| metadata.file_type().is_symlink())
                .unwrap_or(false);
            if is_dangling_symlink {
                write_file_in_place_unlocked(path, content, true)?;
            } else {
                atomic_write_file_unlocked(path, content)?;
            }
        }
        Err(error) => return Err(error.into()),
    }
    bump_file_write_generation(path)?;
    Ok(ConditionalWriteResult {
        status: ConditionalWriteStatus::Success,
        revision: file_write_revision_unlocked(path)?,
    })
}

pub fn exists(path: &Path) -> bool {
    Path::new(path).exists()
}

pub fn create_file<P: AsRef<Path>>(filename: P) -> FileResult {
    let filename = filename.as_ref();
    if let Some(parent) = filename.parent() {
        if !parent.exists() {
            if let Err(e) = fs::create_dir_all(parent) {
                return FileResult {
                    code: FileResultCode::UnknownError,
                    content: format!("Failed to create parent directories: {}", e),
                };
            }
        }
    }
    match fs::File::create(filename) {
        Ok(_) => FileResult {
            code: FileResultCode::Success,
            content: String::from("File created successfully"),
        },
        Err(e) => {
            let code = match e.kind() {
                std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                _ => FileResultCode::UnknownError,
            };
            FileResult {
                code,
                content: format!("Failed to create file: {}", e),
            }
        }
    }
}

pub fn create_folder(path: &str) -> FileResult {
    let dir_path = Path::new(path);
    match fs::create_dir(dir_path) {
        Ok(()) => FileResult {
            code: FileResultCode::Success,
            content: String::from(""),
        },
        Err(e) => {
            let code = match e.kind() {
                std::io::ErrorKind::AlreadyExists => FileResultCode::InvalidPath,
                std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                _ => FileResultCode::UnknownError,
            };
            FileResult {
                code,
                content: format!("Failed to create folder: {}", e),
            }
        }
    }
}

pub fn remove_file(path: &str) -> FileResult {
    let file_path = Path::new(path);
    match fs::remove_file(file_path) {
        Ok(()) => FileResult {
            code: FileResultCode::Success,
            content: String::from("File removed successfully"),
        },
        Err(e) => {
            let code = match e.kind() {
                std::io::ErrorKind::NotFound => FileResultCode::NotFound,
                std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                _ => FileResultCode::UnknownError,
            };
            FileResult {
                code,
                content: format!("Failed to remove file: {}", e),
            }
        }
    }
}

pub fn remove_folder(path: &str) -> FileResult {
    let folder_path = Path::new(path);
    match fs::remove_dir_all(folder_path) {
        Ok(()) => FileResult {
            code: FileResultCode::Success,
            content: String::from("Folder removed successfully"),
        },
        Err(e) => {
            let code = match e.kind() {
                std::io::ErrorKind::NotFound => FileResultCode::NotFound,
                std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                _ => FileResultCode::UnknownError,
            };
            FileResult {
                code,
                content: format!("Failed to remove folder: {}", e),
            }
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct MoveFileInfo {
    old_path: String,
    new_path: String,
    children: Option<Vec<FileInfo>>,
    is_folder: bool,
    is_replaced: Option<bool>,
}

pub fn rename_fs(old_path: &Path, new_path: &Path) -> AnyResult<MoveFileInfo> {
    // Capture the kind before rename: after a successful move, querying old_path is invalid.
    let is_folder = fs::metadata(old_path)?.is_dir();

    if old_path != new_path {
        fs::rename(old_path, new_path)?;
    }

    Ok(MoveFileInfo {
        old_path: old_path.to_string_lossy().into_owned(),
        new_path: new_path.to_string_lossy().into_owned(),
        is_folder,
        // The frontend rebases already-loaded descendants and does not consume this field.
        // Avoid scanning a potentially large directory on the synchronous rename path.
        children: None,
        is_replaced: Some(false),
    })
}

pub fn paths_refer_to_same_file(path1: &Path, path2: &Path) -> bool {
    path1.exists() && path2.exists() && same_file::is_same_file(path1, path2).unwrap_or(false)
}

fn resolved_directory_entry(path: &Path) -> Option<PathBuf> {
    let parent = path.parent()?;
    let requested_name = path.file_name()?;
    let mut matching_entries = fs::read_dir(parent)
        .ok()?
        .filter_map(Result::ok)
        .filter(|entry| paths_refer_to_same_file(&entry.path(), path))
        .collect::<Vec<_>>();

    if let Some(exact_entry) = matching_entries
        .iter()
        .find(|entry| entry.file_name() == requested_name)
    {
        return Some(exact_entry.path());
    }

    if matching_entries.len() == 1 {
        return matching_entries.pop().map(|entry| entry.path());
    }

    None
}

/// Distinguishes a case/Unicode alias of one directory entry from a different
/// hardlink or symlink that happens to resolve to the same physical file.
pub fn paths_refer_to_same_directory_entry(path1: &Path, path2: &Path) -> bool {
    if !paths_refer_to_same_file(path1, path2) {
        return false;
    }

    let (Some(parent1), Some(parent2)) = (path1.parent(), path2.parent()) else {
        return false;
    };
    if !paths_refer_to_same_file(parent1, parent2) {
        return false;
    }

    let (Some(entry1), Some(entry2)) = (
        resolved_directory_entry(path1),
        resolved_directory_entry(path2),
    ) else {
        return false;
    };

    entry1.file_name() == entry2.file_name()
}

fn unique_replace_backup_path(target_path: &Path) -> AnyResult<PathBuf> {
    let parent = target_path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Replacement target has no parent"))?;
    let file_name = target_path
        .file_name()
        .ok_or_else(|| anyhow::anyhow!("Replacement target has no file name"))?;

    for _ in 0..16 {
        let mut backup_name = std::ffi::OsString::from(".");
        backup_name.push(file_name);
        backup_name.push(format!(".markflowy-replace-{}.bak", uuid::Uuid::new_v4()));
        let backup_path = parent.join(backup_name);
        if !backup_path.exists() {
            return Ok(backup_path);
        }
    }

    Err(anyhow::anyhow!(
        "Failed to allocate a unique replacement backup path"
    ))
}

fn remove_path(path: &Path, is_folder: bool) -> std::io::Result<()> {
    if is_folder {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    }
}

fn replace_path(source_path: &Path, target_path: &Path) -> AnyResult<Vec<MoveFileInfo>> {
    if paths_refer_to_same_file(source_path, target_path) {
        return Ok(Vec::new());
    }

    let target_is_folder = fs::metadata(target_path)?.is_dir();
    let backup_path = unique_replace_backup_path(target_path)?;
    fs::rename(target_path, &backup_path)?;

    let moved = match rename_fs(source_path, target_path) {
        Ok(moved) => moved,
        Err(move_error) => {
            return match fs::rename(&backup_path, target_path) {
                Ok(()) => Err(anyhow::anyhow!(
                    "Failed to replace {}: {}; the original target was restored",
                    target_path.display(),
                    move_error
                )),
                Err(rollback_error) => Err(anyhow::anyhow!(
                    "Failed to replace {}: {}; rollback also failed: {}. Original target remains at {}",
                    target_path.display(),
                    move_error,
                    rollback_error,
                    backup_path.display()
                )),
            };
        }
    };

    if let Err(error) = remove_path(&backup_path, target_is_folder) {
        // The requested replacement is already complete. Reporting failure here would leave the
        // frontend stale, so retain the backup and surface the cleanup issue diagnostically.
        log::warn!(
            "Replacement succeeded but backup cleanup failed for {}: {}",
            backup_path.display(),
            error
        );
    }

    Ok(vec![
        MoveFileInfo {
            old_path: target_path.to_string_lossy().into_owned(),
            new_path: String::new(),
            is_folder: target_is_folder,
            children: None,
            is_replaced: Some(true),
        },
        moved,
    ])
}

pub fn move_files_to_target_folder(
    files: Vec<String>,
    target_folder: &str,
    replace_exist: bool,
) -> AnyResult<Vec<MoveFileInfo>> {
    let mut path_map_old_to_new = vec![];
    let mut move_errors = vec![];

    for file in files {
        let file_path = Path::new(&file);
        let file_name = match file_path.file_name() {
            Some(name) => name,
            None => {
                move_errors.push(format!("Invalid source path: {}", file_path.display()));
                continue;
            }
        };
        let target_path = Path::new(target_folder).join(file_name);

        if paths_refer_to_same_file(file_path, &target_path) {
            continue;
        }

        let move_result = if target_path.exists() {
            if !replace_exist {
                continue;
            }
            replace_path(file_path, &target_path)
        } else {
            rename_fs(file_path, &target_path).map(|move_info| vec![move_info])
        };

        match move_result {
            Ok(move_infos) => path_map_old_to_new.extend(move_infos),
            Err(error) => {
                let message = format!(
                    "Failed to move {} to {}: {}",
                    file_path.display(),
                    target_path.display(),
                    error
                );
                log::warn!("{}", message);
                move_errors.push(message);
            }
        }
    }

    // Keep already completed moves observable to the frontend. If every attempted move failed,
    // reject the command so callers still receive a real error instead of a misleading null.
    if path_map_old_to_new.is_empty() && !move_errors.is_empty() {
        return Err(anyhow::anyhow!(move_errors.join("; ")));
    }

    Ok(path_map_old_to_new)
}

pub fn is_dir(path: &str) -> bool {
    let file_path = Path::new(path);
    file_path.is_dir()
}

pub fn get_path_name(path: &str) -> String {
    let file_path = Path::new(path);
    match file_path.file_name() {
        Some(name) => name.to_str().unwrap_or("").to_string(),
        None => String::from(""),
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileNormalInfo {
    pub size: String,
    pub last_modified: String,
    pub error_msg: String,
}

impl Default for FileNormalInfo {
    fn default() -> Self {
        FileNormalInfo {
            size: "".into(),
            last_modified: "".into(),
            error_msg: "".into(),
        }
    }
}

fn format_file_size(size: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if size >= GB {
        format!("{:.2} GB", size as f64 / GB as f64)
    } else if size >= MB {
        format!("{:.2} MB", size as f64 / MB as f64)
    } else if size >= KB {
        format!("{:.2} KB", size as f64 / KB as f64)
    } else {
        format!("{} bytes", size)
    }
}

pub fn get_file_normal_info(path_str: &str) -> FileNormalInfo {
    let path = Path::new(path_str);

    // 尝试获取元数据
    let metadata_result = fs::metadata(path);

    match metadata_result {
        Ok(metadata) => {
            // 获取并格式化文件大小
            let size = metadata.len();
            let formatted_size = format_file_size(size);

            // 获取并格式化修改时间
            let modified_time = match metadata.modified() {
                Ok(time) => {
                    let datetime: DateTime<Local> = DateTime::from(time);
                    format!("{}", datetime.format("%Y-%m-%d %H:%M:%S"))
                }
                Err(e) => {
                    return FileNormalInfo {
                        size: "".to_string(),
                        last_modified: "".to_string(),
                        error_msg: format!("无法获取修改时间: {}", e),
                    };
                }
            };

            FileNormalInfo {
                size: formatted_size,
                last_modified: modified_time,
                error_msg: "".to_string(),
            }
        }
        Err(e) => FileNormalInfo {
            size: "".to_string(),
            last_modified: "".to_string(),
            error_msg: format!("无法获取文件元数据: {}", e),
        },
    }
}

pub async fn convert_text_async(text: String, variant: String) -> Result<String, SystemError> {
    use zhconv::{zhconv, Variant};

    tokio::task::spawn_blocking(move || {
        let variant = match variant.as_str() {
            "zh-TW" => Variant::ZhTW,
            "zh-HK" => Variant::ZhHK,
            "zh-CN" => Variant::ZhCN,
            "zh-Hans" => Variant::ZhHans,
            _ => Variant::ZhTW,
        };
        zhconv(&text, variant)
    })
    .await
    .map_err(|_| SystemError::TaskAborted(uuid::Uuid::nil()))
}

pub mod cmd {
    use crate::fc::{self, ConditionalWriteResult, FileNormalInfo, FileResultCode};
    use base64::engine::Engine;
    use base64::prelude::BASE64_STANDARD;
    use regex::Regex;
    use std::fs;
    use std::path::Path;
    use trash;

    use super::{FileResult, MoveFileInfo};

    #[tauri::command]
    pub fn open_folder_async(
        folder_path: &str,
        root_path: Option<String>,
        file_exclude_patterns: Option<String>,
    ) -> FileResult {
        match fc::read_directory(folder_path) {
            Ok(files) => {
                let mut files = files;
                if let Some(patterns) = file_exclude_patterns
                    .as_deref()
                    .filter(|patterns| !patterns.trim().is_empty())
                {
                    files = fc::filter_files_by_exclude_patterns(
                        files,
                        root_path.as_deref().unwrap_or(folder_path),
                        patterns,
                    );
                }

                fc::files_to_json(files)
            }
            Err(code) => FileResult {
                code,
                content: String::from("Failed to read directory"),
            },
        }
    }

    #[tauri::command]
    pub async fn get_file_content(file_path: String) -> Result<FileResult, String> {
        Ok(fc::read_file_async(&file_path).await)
    }

    #[tauri::command]
    pub async fn write_file(file_path: String, content: String) -> Result<FileResult, String> {
        tokio::task::spawn_blocking(move || fc::write_file(&file_path, &content))
            .await
            .map_err(|error| error.to_string())
    }

    #[tauri::command]
    pub async fn get_file_write_revision(file_path: String) -> Result<String, String> {
        tokio::task::spawn_blocking(move || fc::get_file_write_revision(Path::new(&file_path)))
            .await
            .map_err(|error| error.to_string())?
            .map_err(|error| error.to_string())
    }

    #[tauri::command]
    pub async fn conditional_write_file(
        file_path: String,
        content: String,
        expected_revision: String,
    ) -> Result<ConditionalWriteResult, String> {
        tokio::task::spawn_blocking(move || {
            fc::conditional_write_file(
                Path::new(&file_path),
                content.as_bytes(),
                &expected_revision,
            )
        })
        .await
        .map_err(|error| error.to_string())?
        .map_err(|error| error.to_string())
    }

    #[tauri::command]
    pub fn read_u8_array_from_file(file_path: &str) -> FileResult {
        match fs::read(file_path) {
            Ok(content) => FileResult {
                code: FileResultCode::Success,
                content: BASE64_STANDARD.encode(content),
            },
            Err(e) => {
                let code = match e.kind() {
                    std::io::ErrorKind::NotFound => FileResultCode::NotFound,
                    std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                    _ => FileResultCode::UnknownError,
                };
                FileResult {
                    code,
                    content: format!("Failed to read file: {}", e),
                }
            }
        }
    }

    #[tauri::command]
    pub fn write_u8_array_to_file(file_path: &str, content: Vec<u8>) -> FileResult {
        let file_path = Path::new(file_path);

        // Create parent directories if they don't exist
        if let Some(parent) = file_path.parent() {
            if !parent.exists() {
                if let Err(e) = fs::create_dir_all(parent) {
                    let code = match e.kind() {
                        std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                        _ => FileResultCode::UnknownError,
                    };
                    return FileResult {
                        code,
                        content: format!("Failed to create parent directories: {}", e),
                    };
                }
            }
        }

        // Write the file content
        match fs::write(file_path, content) {
            Ok(()) => FileResult {
                code: FileResultCode::Success,
                content: String::from("File written successfully"),
            },
            Err(e) => {
                let code = match e.kind() {
                    std::io::ErrorKind::NotFound => FileResultCode::NotFound,
                    std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                    _ => FileResultCode::UnknownError,
                };
                FileResult {
                    code,
                    content: format!("Failed to write file: {}", e),
                }
            }
        }
    }

    #[tauri::command]
    pub fn delete_file(file_path: &str) -> String {
        fc::remove_file(file_path);
        String::from("OK")
    }

    #[tauri::command]
    pub fn create_folder(path: &str) -> FileResult {
        fc::create_folder(path)
    }

    #[tauri::command]
    pub fn delete_folder(file_path: &str) -> FileResult {
        fc::remove_folder(file_path)
    }

    #[tauri::command]
    pub fn file_exists(file_path: &str) -> bool {
        fc::exists(Path::new(file_path))
    }

    #[tauri::command]
    pub fn is_text_file(file_path: &str) -> bool {
        fc::is_text_file(file_path)
    }

    #[tauri::command]
    pub fn move_files_to_target_folder(
        files: Vec<String>,
        target_folder: &str,
        replace_exist: bool,
    ) -> Result<Vec<MoveFileInfo>, String> {
        fc::move_files_to_target_folder(files, target_folder, replace_exist)
            .map_err(|error| error.to_string())
    }

    #[tauri::command]
    pub fn path_join(path1: &str, path2: &str) -> String {
        let path = Path::new(path1).join(path2);
        path.to_str().unwrap_or("").to_string()
    }

    #[tauri::command]
    pub fn rename_fs(old_path: &str, new_path: &str) -> Result<MoveFileInfo, String> {
        let path = Path::new(old_path);
        let new_path = Path::new(new_path);
        fc::rename_fs(path, new_path).map_err(|error| error.to_string())
    }

    #[tauri::command]
    pub fn paths_refer_to_same_file(path1: &str, path2: &str) -> bool {
        fc::paths_refer_to_same_file(Path::new(path1), Path::new(path2))
    }

    #[tauri::command]
    pub fn paths_refer_to_same_directory_entry(path1: &str, path2: &str) -> bool {
        fc::paths_refer_to_same_directory_entry(Path::new(path1), Path::new(path2))
    }

    #[tauri::command]
    pub fn get_md_relative_path(file_path: &str, relative_to: &str) -> FileResult {
        use std::path::Component;

        let cur_path = Path::new(file_path);
        let relative_to_path = Path::new(relative_to);

        if !cur_path.is_absolute() {
            return FileResult {
                code: FileResultCode::InvalidPath,
                content: "File path must be absolute".to_string(),
            };
        }

        if !relative_to_path.is_absolute() {
            return FileResult {
                code: FileResultCode::InvalidPath,
                content: "Relative path must be absolute".to_string(),
            };
        }

        let cur_components: Vec<Component> = cur_path.components().collect();
        let relative_to_components: Vec<Component> = relative_to_path.components().collect();

        let common_prefix_len = cur_components
            .iter()
            .zip(relative_to_components.iter())
            .take_while(|(a, b)| a == b)
            .count();

        let mut components = vec![];
        for _ in common_prefix_len..relative_to_components.len() {
            components.push("..");
        }

        for component in &cur_components[common_prefix_len..] {
            if let Component::Normal(name) = component {
                if let Some(name_str) = name.to_str() {
                    components.push(name_str);
                } else {
                    return FileResult {
                        code: FileResultCode::InvalidPath,
                        content: "Failed to convert path to string (invalid UTF-8)".to_string(),
                    };
                }
            } else if let Component::CurDir | Component::ParentDir = component {
                match component {
                    Component::Normal(name) => {
                        if let Some(name_str) = name.to_str() {
                            components.push(name_str);
                        } else {
                            return FileResult {
                                code: FileResultCode::InvalidPath,
                                content: "Failed to convert path to string (invalid UTF-8)"
                                    .to_string(),
                            };
                        }
                    }
                    Component::CurDir => {
                        components.push(".");
                    }
                    Component::ParentDir => {
                        components.push("..");
                    }
                    Component::Prefix(_) => {
                        // Windows驱动器前缀，忽略
                        continue;
                    }
                    Component::RootDir => {
                        // Unix根目录，忽略
                        continue;
                    }
                }
            }
        }

        let relative_path = if components.is_empty() {
            ".".to_string()
        } else {
            components.join("/")
        };

        // 确保返回的是Markdown语法的路径（使用正斜杠）
        let md_relative_path = relative_path.replace("\\", "/");

        FileResult {
            code: FileResultCode::Success,
            content: md_relative_path,
        }
    }

    #[tauri::command]
    pub fn copy_file_by_from(from: &str) -> Option<String> {
        let from_path = Path::new(from);
        let parent_path = from_path.parent()?;
        let mut to_path_name = from_path.file_stem()?.to_str()?.to_string();

        let file_ext = from_path.extension()?;

        while parent_path
            .join(&format!(
                "{}.{}",
                to_path_name.clone(),
                file_ext.to_str().unwrap_or("")
            ))
            .exists()
        {
            to_path_name.push_str(" copy");
        }

        to_path_name.push_str(format!(".{}", file_ext.to_str().unwrap_or("")).as_str());

        let to_path = parent_path.join(&to_path_name);
        fs::copy(from_path, to_path.clone()).ok()?;

        Some(to_path.to_str()?.to_string())
    }

    #[tauri::command]
    pub fn trash_delete(path: &str) -> bool {
        trash::delete(path).is_ok()
    }

    #[tauri::command]
    pub fn export_html_to_path(str: &str, path: &str) -> String {
        let re = Regex::new(r#"\\\""#).unwrap();

        let result = re.replace_all(str, "\"");

        let file_path = Path::new(path);

        match fs::write(file_path, result.to_string()) {
            Ok(_) => String::from("OK"),
            Err(e) => format!("ERROR: {}", e),
        }
    }

    #[tauri::command]
    pub fn is_dir(path: &str) -> bool {
        fc::is_dir(path)
    }

    #[tauri::command]
    pub fn get_path_name(path: &str) -> String {
        fc::get_path_name(path)
    }

    #[tauri::command]
    pub fn get_file_normal_info(path: &str) -> FileNormalInfo {
        fc::get_file_normal_info(path)
    }

    #[tauri::command]
    pub fn copy_file(from: &str, to: &str) -> FileResult {
        let old_path = Path::new(from);
        let new_path = Path::new(to);

        // Validate input paths
        if from.is_empty() || to.is_empty() {
            return FileResult {
                code: FileResultCode::InvalidPath,
                content: String::from("Source or destination path cannot be empty"),
            };
        }

        // Check if source file exists
        if !old_path.exists() {
            return FileResult {
                code: FileResultCode::NotFound,
                content: format!("Source file not found: {}", from),
            };
        }

        // Create parent directories for destination if they don't exist
        if let Some(parent) = new_path.parent() {
            if !parent.exists() {
                if let Err(e) = fs::create_dir_all(parent) {
                    let code = match e.kind() {
                        std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                        _ => FileResultCode::UnknownError,
                    };
                    return FileResult {
                        code,
                        content: format!(
                            "Failed to create parent directories for destination: {}",
                            e
                        ),
                    };
                }
            }
        }

        // Perform the copy operation
        match fs::copy(old_path, new_path) {
            Ok(bytes_copied) => FileResult {
                code: FileResultCode::Success,
                content: format!("File copied successfully ({} bytes)", bytes_copied),
            },
            Err(e) => {
                let code = match e.kind() {
                    std::io::ErrorKind::NotFound => FileResultCode::NotFound,
                    std::io::ErrorKind::PermissionDenied => FileResultCode::PermissionDenied,
                    std::io::ErrorKind::AlreadyExists => FileResultCode::InvalidPath,
                    _ => FileResultCode::UnknownError,
                };
                FileResult {
                    code,
                    content: format!("Failed to copy file from '{}' to '{}': {}", from, to, e),
                }
            }
        }
    }

    #[tauri::command]
    pub async fn convert_text(text: String, variant: String) -> FileResult {
        match fc::convert_text_async(text, variant).await {
            Ok(content) => FileResult {
                code: FileResultCode::Success,
                content,
            },
            Err(e) => FileResult {
                code: FileResultCode::UnknownError,
                content: e.to_string(),
            },
        }
    }

    #[tauri::command]
    pub fn save_security_bookmark(path: &str) -> bool {
        #[cfg(target_os = "macos")]
        {
            let path = Path::new(path);
            super::security_bookmark::save_bookmark(path) && fc::acquire_security_scope(path)
        }
        #[cfg(not(target_os = "macos"))]
        {
            true
        }
    }

    #[tauri::command]
    pub fn restore_security_bookmark(path: &str) -> bool {
        fc::acquire_security_scope(Path::new(path))
    }

    #[tauri::command]
    pub fn release_security_scopes(path: Option<String>) -> bool {
        match path {
            Some(path) => fc::release_security_scope(Path::new(&path)),
            None => fc::release_all_security_scopes(),
        }
    }

    /// 预激活工作区根路径的安全范围，打开文件夹时调用
    /// 后续该文件夹下所有文件的读取可直接命中缓存，避免 PermissionDenied
    #[tauri::command]
    pub fn activate_workspace_root(root_path: &str) -> bool {
        #[cfg(target_os = "macos")]
        {
            let path = Path::new(root_path);
            if fc::acquire_security_scope(path) {
                let key = super::security_scope_key(path);
                if let Ok(mut root) = super::WORKSPACE_ROOT_SCOPE.lock() {
                    *root = Some(key);
                }
                true
            } else {
                false
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            true
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_file(name: &str, kind: &str, path: &str) -> FileInfo {
        FileInfo {
            name: name.to_string(),
            kind: kind.to_string(),
            path: path.to_string(),
            children: if kind == "dir" {
                Some(Vec::new())
            } else {
                None
            },
            ext: Path::new(path)
                .extension()
                .and_then(|ext| ext.to_str())
                .unwrap_or("")
                .to_string(),
        }
    }

    #[test]
    fn filters_directory_entries_with_rust_ignore_matcher() {
        let files = vec![
            test_file("build", "dir", "/workspace/build"),
            test_file("src", "dir", "/workspace/src"),
            test_file("keep.tmp", "file", "/workspace/keep.tmp"),
            test_file("drop.tmp", "file", "/workspace/drop.tmp"),
        ];

        let filtered =
            filter_files_by_exclude_patterns(files, "/workspace", "/build/\n*.tmp\n!keep.tmp\n");

        let names = filtered
            .iter()
            .map(|file| file.name.as_str())
            .collect::<Vec<_>>();

        assert_eq!(names, vec!["src", "keep.tmp"]);
    }

    #[test]
    fn directory_rename_does_not_rescan_children() {
        let temp_dir = tempfile::tempdir().unwrap();
        let old_path = temp_dir.path().join("old");
        let new_path = temp_dir.path().join("new");
        fs::create_dir(&old_path).unwrap();
        fs::write(old_path.join("child.md"), "content").unwrap();

        let moved = rename_fs(&old_path, &new_path).unwrap();

        assert!(moved.is_folder);
        assert!(moved.children.is_none());
        assert!(!old_path.exists());
        assert!(new_path.join("child.md").exists());
    }

    #[test]
    fn replacing_a_path_with_itself_is_a_noop() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("note.md");
        fs::write(&file_path, "keep me").unwrap();

        let moved = move_files_to_target_folder(
            vec![file_path.to_string_lossy().into_owned()],
            &temp_dir.path().to_string_lossy(),
            true,
        )
        .unwrap();

        assert!(moved.is_empty());
        assert_eq!(fs::read_to_string(file_path).unwrap(), "keep me");
    }

    #[test]
    fn detects_distinct_paths_that_refer_to_the_same_file() {
        let temp_dir = tempfile::tempdir().unwrap();
        let original_path = temp_dir.path().join("original.md");
        let alias_path = temp_dir.path().join("alias.md");
        fs::write(&original_path, "content").unwrap();
        fs::hard_link(&original_path, &alias_path).unwrap();

        assert!(paths_refer_to_same_file(&original_path, &alias_path));
        assert!(!paths_refer_to_same_file(
            &original_path,
            &temp_dir.path().join("missing.md")
        ));
        assert!(!paths_refer_to_same_directory_entry(
            &original_path,
            &alias_path
        ));
        assert!(paths_refer_to_same_directory_entry(
            &original_path,
            &original_path
        ));
    }

    #[test]
    fn detects_case_aliases_without_merging_case_sensitive_entries() {
        let temp_dir = tempfile::tempdir().unwrap();
        let original_path = temp_dir.path().join("CaseAlias.md");
        let alias_path = temp_dir.path().join("casealias.md");
        fs::write(&original_path, "content").unwrap();

        if paths_refer_to_same_file(&original_path, &alias_path) {
            assert!(paths_refer_to_same_directory_entry(
                &original_path,
                &alias_path
            ));
        } else {
            fs::write(&alias_path, "other content").unwrap();
            assert!(!paths_refer_to_same_directory_entry(
                &original_path,
                &alias_path
            ));
        }
    }

    #[test]
    fn conditional_atomic_write_rejects_a_stale_revision() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("note.md");
        fs::write(&file_path, "initial").unwrap();
        let expected_revision = get_file_write_revision(&file_path).unwrap();

        let first = conditional_write_file(&file_path, b"first", &expected_revision).unwrap();
        let second = conditional_write_file(&file_path, b"second", &expected_revision).unwrap();

        assert_eq!(first.status, ConditionalWriteStatus::Success);
        assert_eq!(second.status, ConditionalWriteStatus::Conflict);
        assert_eq!(fs::read_to_string(file_path).unwrap(), "first");
    }

    #[test]
    fn conditional_atomic_write_advances_revision_for_identical_content() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("note.md");
        fs::write(&file_path, "same").unwrap();
        let expected_revision = get_file_write_revision(&file_path).unwrap();

        let first = conditional_write_file(&file_path, b"same", &expected_revision).unwrap();
        let second = conditional_write_file(&file_path, b"other", &expected_revision).unwrap();

        assert_eq!(first.status, ConditionalWriteStatus::Success);
        assert_eq!(second.status, ConditionalWriteStatus::Conflict);
        assert_eq!(fs::read_to_string(file_path).unwrap(), "same");
    }

    #[test]
    fn conditional_atomic_write_distinguishes_a_missing_target() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("new.md");
        let missing_revision = get_file_write_revision(&file_path).unwrap();
        assert!(missing_revision.starts_with("missing:generation:"));

        let first = conditional_write_file(&file_path, b"created", &missing_revision).unwrap();
        let second = conditional_write_file(&file_path, b"replaced", &missing_revision).unwrap();

        assert_eq!(first.status, ConditionalWriteStatus::Success);
        assert_eq!(second.status, ConditionalWriteStatus::Conflict);
        assert_eq!(fs::read_to_string(file_path).unwrap(), "created");
    }

    #[test]
    fn conditional_write_rejects_a_missing_path_aba_revision() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("created-then-deleted.md");
        let missing_revision = get_file_write_revision(&file_path).unwrap();

        conditional_write_file(&file_path, b"temporary", &missing_revision).unwrap();
        fs::remove_file(&file_path).unwrap();
        let current_missing_revision = get_file_write_revision(&file_path).unwrap();
        let stale_write = conditional_write_file(&file_path, b"stale", &missing_revision).unwrap();

        assert_ne!(current_missing_revision, missing_revision);
        assert_eq!(stale_write.status, ConditionalWriteStatus::Conflict);
        assert!(!file_path.exists());
    }

    #[test]
    fn conditional_write_updates_hardlinks_in_place() {
        let temp_dir = tempfile::tempdir().unwrap();
        let selected_path = temp_dir.path().join("selected.md");
        let other_link = temp_dir.path().join("other-link.md");
        fs::write(&selected_path, "old").unwrap();
        fs::hard_link(&selected_path, &other_link).unwrap();
        let original_metadata = fs::metadata(&selected_path).unwrap();
        let revision = get_file_write_revision(&selected_path).unwrap();

        let result = conditional_write_file(&selected_path, b"new", &revision).unwrap();

        assert_eq!(result.status, ConditionalWriteStatus::Success);
        assert_eq!(fs::read_to_string(&selected_path).unwrap(), "new");
        assert_eq!(fs::read_to_string(&other_link).unwrap(), "new");
        assert!(paths_refer_to_same_file(&selected_path, &other_link));

        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            assert_eq!(
                fs::metadata(selected_path).unwrap().ino(),
                original_metadata.ino()
            );
        }
    }

    #[cfg(unix)]
    #[test]
    fn conditional_atomic_write_follows_symlink_without_replacing_it() {
        use std::os::unix::fs::symlink;

        let temp_dir = tempfile::tempdir().unwrap();
        let target_path = temp_dir.path().join("target.md");
        let link_path = temp_dir.path().join("link.md");
        fs::write(&target_path, "old").unwrap();
        symlink(&target_path, &link_path).unwrap();
        let revision = get_file_write_revision(&link_path).unwrap();

        let result = conditional_write_file(&link_path, b"new", &revision).unwrap();

        assert_eq!(result.status, ConditionalWriteStatus::Success);
        assert!(fs::symlink_metadata(&link_path)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_link(&link_path).unwrap(), target_path);
        assert_eq!(fs::read_to_string(&link_path).unwrap(), "new");
        assert_eq!(fs::read_to_string(&target_path).unwrap(), "new");
    }

    #[cfg(unix)]
    #[test]
    fn conditional_write_keeps_a_dangling_symlink_entry() {
        use std::os::unix::fs::symlink;

        let temp_dir = tempfile::tempdir().unwrap();
        let target_path = temp_dir.path().join("created-target.md");
        let link_path = temp_dir.path().join("dangling-link.md");
        symlink(&target_path, &link_path).unwrap();
        let revision = get_file_write_revision(&link_path).unwrap();

        conditional_write_file(&link_path, b"created", &revision).unwrap();

        assert!(fs::symlink_metadata(&link_path)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(fs::read_to_string(target_path).unwrap(), "created");
    }

    #[cfg(unix)]
    #[test]
    fn conditional_atomic_write_preserves_existing_permissions() {
        use std::os::unix::fs::{MetadataExt, PermissionsExt};

        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("permissions.md");
        fs::write(&file_path, "old").unwrap();
        fs::set_permissions(&file_path, fs::Permissions::from_mode(0o640)).unwrap();
        let revision = get_file_write_revision(&file_path).unwrap();

        conditional_write_file(&file_path, b"new", &revision).unwrap();

        assert_eq!(fs::metadata(file_path).unwrap().mode() & 0o777, 0o640);
    }

    #[test]
    fn replace_moves_source_and_cleans_the_backup() {
        let temp_dir = tempfile::tempdir().unwrap();
        let source_dir = temp_dir.path().join("source");
        let target_dir = temp_dir.path().join("target");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&target_dir).unwrap();
        let source_path = source_dir.join("note.md");
        let target_path = target_dir.join("note.md");
        fs::write(&source_path, "new content").unwrap();
        fs::write(&target_path, "old content").unwrap();

        let moved = move_files_to_target_folder(
            vec![source_path.to_string_lossy().into_owned()],
            &target_dir.to_string_lossy(),
            true,
        )
        .unwrap();

        assert_eq!(moved.len(), 2);
        assert_eq!(moved[0].is_replaced, Some(true));
        assert_eq!(moved[0].old_path, target_path.to_string_lossy());
        assert_eq!(moved[1].old_path, source_path.to_string_lossy());
        assert!(!source_path.exists());
        assert_eq!(fs::read_to_string(&target_path).unwrap(), "new content");
        assert_eq!(fs::read_dir(&target_dir).unwrap().count(), 1);
    }

    #[test]
    fn failed_replace_restores_the_original_target() {
        let temp_dir = tempfile::tempdir().unwrap();
        let source_dir = temp_dir.path().join("source");
        let target_dir = temp_dir.path().join("target");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&target_dir).unwrap();
        let missing_source = source_dir.join("note.md");
        let target_path = target_dir.join("note.md");
        fs::write(&target_path, "original content").unwrap();

        let result = move_files_to_target_folder(
            vec![missing_source.to_string_lossy().into_owned()],
            &target_dir.to_string_lossy(),
            true,
        );

        assert!(result.is_err());
        assert_eq!(
            fs::read_to_string(&target_path).unwrap(),
            "original content"
        );
        assert_eq!(fs::read_dir(&target_dir).unwrap().count(), 1);
    }

    #[test]
    fn multi_move_returns_successes_when_a_later_item_fails() {
        let temp_dir = tempfile::tempdir().unwrap();
        let source_dir = temp_dir.path().join("source");
        let target_dir = temp_dir.path().join("target");
        fs::create_dir(&source_dir).unwrap();
        fs::create_dir(&target_dir).unwrap();
        let source_path = source_dir.join("good.md");
        let missing_source = source_dir.join("missing.md");
        fs::write(&source_path, "moved content").unwrap();

        let moved = move_files_to_target_folder(
            vec![
                source_path.to_string_lossy().into_owned(),
                missing_source.to_string_lossy().into_owned(),
            ],
            &target_dir.to_string_lossy(),
            false,
        )
        .unwrap();

        assert_eq!(moved.len(), 1);
        assert_eq!(moved[0].old_path, source_path.to_string_lossy());
        assert_eq!(
            fs::read_to_string(target_dir.join("good.md")).unwrap(),
            "moved content"
        );
    }

    #[tokio::test]
    async fn converts_text_on_the_shared_blocking_pool() {
        let converted = convert_text_async("汉语".to_string(), "zh-TW".to_string())
            .await
            .unwrap();

        assert_eq!(converted, "漢語");
    }
}
