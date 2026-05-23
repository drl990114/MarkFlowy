use anyhow::Result as AnyResult;
use chrono::{DateTime, Local};
use mf_utils::is_supported_file_name;
use natural_sort_rs::Natural;
use serde::{Deserialize, Serialize};
use std::fs;
use std::future::Future;
use std::path::Path;

use crate::task_system::error::SystemError;

#[cfg(target_os = "macos")]
use core_foundation::url::CFURL;
#[cfg(target_os = "macos")]
use core_foundation::base::TCFType;
#[cfg(target_os = "macos")]
use core_foundation_sys::url::{CFURLStartAccessingSecurityScopedResource, CFURLStopAccessingSecurityScopedResource};

#[cfg(target_os = "macos")]
fn start_accessing_security_scoped_resource(path: &Path) -> bool {
    let path_str = match path.to_str() {
        Some(s) => s,
        None => return false,
    };
    
    let cf_url = CFURL::from_path(path_str, true);
    match cf_url {
        Some(url) => {
            unsafe {
                CFURLStartAccessingSecurityScopedResource(url.as_concrete_TypeRef()) != 0
            }
        }
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
mod security_bookmark {
    use core_foundation::base::TCFType;
    use core_foundation::data::CFData;
    use core_foundation::url::CFURL;
    use core_foundation_sys::base::kCFAllocatorDefault;
    use core_foundation_sys::url::{
        CFURLCreateByResolvingBookmarkData, CFURLCreateBookmarkData,
        CFURLStartAccessingSecurityScopedResource,
        kCFURLBookmarkResolutionWithSecurityScope, kCFURLBookmarkCreationWithSecurityScope,
    };
    use std::fs;
    use std::io::{Read, Write};
    use std::path::PathBuf;

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
        use etcetera::app_strategy::{AppStrategyArgs, AppStrategy};
        
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
        file.write_all(&serialized).is_ok()
    }

    pub fn load_all_bookmarks() -> std::collections::HashMap<String, Vec<u8>> {
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
        
        bincode::deserialize(&data).unwrap_or_default()
    }

    pub fn restore_access_for_path(path: &std::path::Path) -> bool {
        let path_str = path.to_string_lossy().to_string();
        let bookmarks = load_all_bookmarks();
        
        if let Some(bookmark_data) = bookmarks.get(&path_str) {
            resolve_security_scoped_bookmark(bookmark_data).is_some()
        } else {
            false
        }
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

#[derive(Debug, Serialize, Deserialize)]
pub enum FileResultCode {
    Success = 0,
    NotFound = -1,
    PermissionDenied = -2,
    InvalidPath = -3,
    UnknownError = -99,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileResult {
    pub code: FileResultCode,
    pub content: String,
}

pub fn read_directory(dir_path: &str) -> Result<Vec<FileInfo>, FileResultCode> {
    read_directory_single_level(dir_path)
}

pub fn read_directory_single_level(dir_path: &str) -> Result<Vec<FileInfo>, FileResultCode> {
    let new_path = Path::new(dir_path);
    
    let has_access = start_accessing_security_scoped_resource(new_path);
    
    let paths = match fs::read_dir(new_path) {
        Ok(paths) => paths,
        Err(e) => {
            if has_access {
                stop_accessing_security_scoped_resource(new_path);
            }
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

    if has_access {
        stop_accessing_security_scoped_resource(new_path);
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

pub fn read_file(path: &str) -> FileResult {
    match fs::read_to_string(path) {
        Ok(content) => FileResult {
            code: FileResultCode::Success,
            content,
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

// update file and create new file
pub fn write_file(path: &str, content: &str) -> FileResult {
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
    fs::rename(old_path, new_path)?;

    let is_folder = new_path.is_dir();

    if is_folder {
        let res = read_directory(new_path.to_str().unwrap_or(""));

        let files: Option<Vec<FileInfo>> = match res {
            Ok(files) => Some(files),
            Err(_) => None,
        };
        if files.is_none() {
            return Err(anyhow::anyhow!("Failed to read directory"));
        }

        Ok(MoveFileInfo {
            old_path: old_path.to_str().unwrap_or("").to_string(),
            new_path: new_path.to_str().unwrap_or("").to_string(),
            is_folder: is_folder,
            children: files,
            is_replaced: Some(false),
        })
    } else {
        Ok(MoveFileInfo {
            old_path: old_path.to_str().unwrap_or("").to_string(),
            new_path: new_path.to_str().unwrap_or("").to_string(),
            is_folder: is_folder,
            children: None,
            is_replaced: Some(false),
        })
    }
}

pub fn move_files_to_target_folder(
    files: Vec<String>,
    target_folder: &str,
    replace_exist: bool,
) -> AnyResult<Vec<MoveFileInfo>> {
    let mut path_map_old_to_new = vec![];

    for file in files {
        let file_path = Path::new(&file);
        let file_name = match file_path.file_name() {
            Some(name) => name,
            None => continue,
        };
        let target_path = Path::new(target_folder).join(file_name);

        if target_path.exists() {
            if replace_exist {
                if target_path.is_dir() {
                    fs::remove_dir_all(target_path.clone())?;
                } else {
                    fs::remove_file(target_path.clone())?;
                }

                path_map_old_to_new.push(MoveFileInfo {
                    old_path: target_path.to_str().unwrap_or("").to_string(),
                    new_path: "".to_string(),
                    is_folder: target_path.is_dir(),
                    children: None,
                    is_replaced: Some(true),
                });
            } else {
                continue;
            }
        }

        let move_file_info = rename_fs(file_path, Path::new(&target_path))?;
        path_map_old_to_new.push(move_file_info);
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

pub fn convert_text_async(
    text: String,
    variant: String,
) -> impl Future<Output = Result<String, SystemError>> {
    use crate::task_system::{
        error::SystemError,
        system::System,
        task::{ExecStatus, Interrupter, Task, TaskId, TaskOutput},
    };
    use async_trait::async_trait;
    use thiserror::Error;
    use zhconv::{zhconv, Variant};

    #[derive(Debug, Error)]
    enum ConvertError {
        #[error("System error: {0}")]
        SystemError(#[from] SystemError),
    }

    #[derive(Debug)]
    struct ConvertTextTask {
        id: TaskId,
        text: String,
        variant: String,
    }

    impl ConvertTextTask {
        fn new(text: String, variant: String) -> Self {
            Self {
                id: TaskId::new_v4(),
                text,
                variant,
            }
        }
    }

    #[async_trait]
    impl Task<ConvertError> for ConvertTextTask {
        fn id(&self) -> TaskId {
            self.id
        }

        fn with_priority(&self) -> bool {
            true
        }

        async fn run(&mut self, _interrupter: &Interrupter) -> Result<ExecStatus, ConvertError> {
            let variant_enum = match self.variant.as_str() {
                "zh-TW" => Variant::ZhTW,
                "zh-HK" => Variant::ZhHK,
                "zh-CN" => Variant::ZhCN,
                "zh-Hans" => Variant::ZhHans,
                _ => Variant::ZhTW,
            };
            let result = zhconv(&self.text, variant_enum);
            Ok(ExecStatus::Done(TaskOutput::Out(Box::new(result))))
        }
    }

    async move {
        let system = System::<ConvertError>::new();
        let task = ConvertTextTask::new(text, variant);
        let handle = system
            .dispatch(task)
            .await
            .map_err(|_| SystemError::TaskAborted(TaskId::nil()))?;

        match handle.await {
            Ok(crate::task_system::task::TaskStatus::Done((_, TaskOutput::Out(out)))) => {
                let text = out
                    .downcast::<String>()
                    .map_err(|_| SystemError::TaskAborted(TaskId::nil()))?;
                Ok(*text)
            }
            Ok(crate::task_system::task::TaskStatus::Error(ConvertError::SystemError(e))) => Err(e),
            _ => Err(SystemError::TaskAborted(TaskId::nil())),
        }
    }
}

pub mod cmd {
    use crate::fc::{self, FileNormalInfo, FileResultCode};
    use base64::engine::Engine;
    use base64::prelude::BASE64_STANDARD;
    use regex::Regex;
    use std::fs;
    use std::path::Path;
    use trash;

    use super::{FileResult, MoveFileInfo};

    #[tauri::command]
    pub fn open_folder_async(folder_path: &str) -> FileResult {
        match fc::read_directory(folder_path) {
            Ok(files) => fc::files_to_json(files),
            Err(code) => FileResult {
                code,
                content: String::from("Failed to read directory"),
            },
        }
    }

    #[tauri::command]
    pub fn get_file_content(file_path: &str) -> FileResult {
        fc::read_file(file_path)
    }

    #[tauri::command]
    pub fn write_file(file_path: &str, content: &str) -> FileResult {
        fc::write_file(file_path, content)
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
    pub fn move_files_to_target_folder(
        files: Vec<String>,
        target_folder: &str,
        replace_exist: bool,
    ) -> Option<Vec<MoveFileInfo>> {
        let res = fc::move_files_to_target_folder(files, target_folder, replace_exist);

        match res {
            Ok(path_map_old_to_new) => Some(path_map_old_to_new),
            Err(_) => None,
        }
    }

    #[tauri::command]
    pub fn path_join(path1: &str, path2: &str) -> String {
        let path = Path::new(path1).join(path2);
        path.to_str().unwrap_or("").to_string()
    }

    #[tauri::command]
    pub fn rename_fs(old_path: &str, new_path: &str) -> Option<MoveFileInfo> {
        let path = Path::new(old_path);
        let new_path = Path::new(new_path);
        fc::rename_fs(path, new_path).ok()
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
            super::security_bookmark::save_bookmark(Path::new(path))
        }
        #[cfg(not(target_os = "macos"))]
        {
            true
        }
    }

    #[tauri::command]
    pub fn restore_security_bookmark(path: &str) -> bool {
        #[cfg(target_os = "macos")]
        {
            super::security_bookmark::restore_access_for_path(Path::new(path))
        }
        #[cfg(not(target_os = "macos"))]
        {
            true
        }
    }
}
