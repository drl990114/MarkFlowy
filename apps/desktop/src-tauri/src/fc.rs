use anyhow::Result as AnyResult;
use mf_utils::is_supported_file_name;
use serde::{Deserialize, Serialize};
use std::fs;
use std::future::Future;
use std::path::Path;

use crate::task_system::error::SystemError;

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
    // 同步版本保留，作为兼容性接口
    let new_path = Path::new(dir_path);
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
            Some(ext) => ext.to_str().unwrap().to_string(),
            None => String::from(""),
        };

        if meta.is_dir() {
            kind = String::from("dir");
            children = match read_directory(file_path.to_str().unwrap()) {
                Ok(children) => Some(children),
                Err(_) => None,
            };
        }

        let new_file_info = FileInfo {
            name: filename,
            kind,
            path: file_path.to_str().unwrap().to_string(),
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

// 新增异步版本，使用task_system
pub fn read_directory_async(
    dir_path: String,
) -> impl Future<Output = Result<Vec<FileInfo>, SystemError>> {
    use crate::task_system::{
        error::SystemError,
        system::System,
        task::{ExecStatus, Interrupter, Task, TaskId, TaskOutput},
    };
    use async_trait::async_trait;
    use thiserror::Error;

    #[derive(Debug, Error)]
    enum ReadDirError {
        #[error("File error: {0:?}")]
        FileError(FileResultCode),
        #[error("System error: {0}")]
        SystemError(#[from] SystemError),
    }

    #[derive(Debug)]
    struct ReadDirectoryTask {
        id: TaskId,
        dir_path: String,
    }

    impl ReadDirectoryTask {
        fn new(dir_path: String) -> Self {
            Self {
                id: TaskId::new_v4(),
                dir_path,
            }
        }
    }

    #[async_trait]
    impl Task<ReadDirError> for ReadDirectoryTask {
        fn id(&self) -> TaskId {
            self.id
        }

        fn with_priority(&self) -> bool {
            // 文件读取任务通常需要优先处理
            true
        }

        async fn run(&mut self, _interrupter: &Interrupter) -> Result<ExecStatus, ReadDirError> {
            // 执行实际的目录读取操作
            match read_directory(&self.dir_path) {
                Ok(files) => Ok(ExecStatus::Done(TaskOutput::Out(Box::new(files)))),
                Err(e) => Err(ReadDirError::FileError(e)),
            }
        }
    }

    async move {
        // 创建任务系统实例
        let system = System::<ReadDirError>::new();

        // 创建目录读取任务并分发
        let task = ReadDirectoryTask::new(dir_path);
        let handle = system
            .dispatch(task)
            .await
            .map_err(|_| SystemError::TaskAborted(TaskId::nil()))?;

        // 等待任务完成并处理结果
        match handle.await {
            Ok(crate::task_system::task::TaskStatus::Done((_, TaskOutput::Out(out)))) => {
                // 将AnyTaskOutput转换回Vec<FileInfo>
                let files = out
                    .downcast::<Vec<FileInfo>>()
                    .map_err(|_| SystemError::TaskAborted(TaskId::nil()))?;
                Ok(*files)
            }
            Ok(crate::task_system::task::TaskStatus::Done((_, TaskOutput::Empty))) => {
                Ok(Vec::new())
            }
            Ok(crate::task_system::task::TaskStatus::Error(ReadDirError::FileError(fc))) => {
                // 使用TaskJoin替代不存在的TaskFailed
                Err(SystemError::TaskJoin(TaskId::nil()))
            }
            Ok(crate::task_system::task::TaskStatus::Error(ReadDirError::SystemError(e))) => Err(e),
            Ok(crate::task_system::task::TaskStatus::Canceled) => {
                Err(SystemError::TaskAborted(TaskId::nil()))
            }
            Ok(crate::task_system::task::TaskStatus::ForcedAbortion) => {
                Err(SystemError::TaskAborted(TaskId::nil()))
            }
            Ok(crate::task_system::task::TaskStatus::Shutdown(_)) => {
                Err(SystemError::TaskAborted(TaskId::nil()))
            }
            Err(e) => Err(e),
        }
    }
}

pub fn sort_files_by_kind_and_name(files: &mut Vec<FileInfo>) {
    files.sort_by(|a, b| {
        if a.kind == b.kind {
            a.name.cmp(&b.name)
        } else {
            if a.kind == "dir" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            }
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
        let res = read_directory(new_path.to_str().unwrap());

        let files: Option<Vec<FileInfo>> = match res {
            Ok(files) => Some(files),
            Err(_) => None,
        };
        if files.is_none() {
            return Err(anyhow::anyhow!("Failed to read directory"));
        }

        Ok(MoveFileInfo {
            old_path: old_path.to_str().unwrap().to_string(),
            new_path: new_path.to_str().unwrap().to_string(),
            is_folder: is_folder,
            children: files,
            is_replaced: Some(false),
        })
    } else {
        Ok(MoveFileInfo {
            old_path: old_path.to_str().unwrap().to_string(),
            new_path: new_path.to_str().unwrap().to_string(),
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
        let file_name = file_path.file_name().unwrap();
        let target_path = Path::new(target_folder).join(file_name);

        if target_path.exists() {
            if replace_exist {
                if target_path.is_dir() {
                    fs::remove_dir_all(target_path.clone())?;
                } else {
                    fs::remove_file(target_path.clone())?;
                }

                path_map_old_to_new.push(MoveFileInfo {
                    old_path: target_path.to_str().unwrap().to_string(),
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
        Some(name) => name.to_str().unwrap().to_string(),
        None => String::from(""),
    }
}

pub mod cmd {
    use crate::fc;
    use regex::Regex;
    use std::fs;
    use std::path::Path;
    use trash;

    use super::{FileResult, MoveFileInfo};

    // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
    #[tauri::command]
    pub fn open_folder(folder_path: &str) -> FileResult {
        let dir_data = fc::read_directory(folder_path);
        match dir_data {
            Ok(files) => {
                let json_data = fc::files_to_json(files);
                let content = match json_data.code {
                    fc::FileResultCode::Success => json_data.content,
                    _ => String::from(""),
                };

                if content == "" {
                    return FileResult {
                        code: fc::FileResultCode::NotFound,
                        content: String::from("Folder not found"),
                    };
                }

                FileResult {
                    code: fc::FileResultCode::Success,
                    content: content,
                }
            }
            Err(_) => FileResult {
                code: fc::FileResultCode::UnknownError,
                content: String::from("Failed to read directory"),
            },
        }
    }

    #[tauri::command]
    pub async fn open_folder_async(folder_path: String) -> FileResult {
        match fc::read_directory_async(folder_path).await {
            Ok(files) => {
                let json_data = fc::files_to_json(files);
                let content = match json_data.code {
                    fc::FileResultCode::Success => json_data.content,
                    _ => String::from(""),
                };

                if content == "" {
                    return FileResult {
                        code: fc::FileResultCode::NotFound,
                        content: String::from("Folder not found"),
                    };
                }

                FileResult {
                    code: fc::FileResultCode::Success,
                    content: content,
                }
            }
            Err(_) => FileResult {
                code: fc::FileResultCode::UnknownError,
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
    pub fn write_u8_array_to_file(file_path: &str, content: Vec<u8>) -> String {
        let file_path = Path::new(file_path);
        fs::write(file_path, content).expect("ERROR");
        String::from("OK")
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
        path.to_str().unwrap().to_string()
    }

    #[tauri::command]
    pub fn rename_fs(old_path: &str, new_path: &str) -> MoveFileInfo {
        let path = Path::new(old_path);
        let new_path = Path::new(new_path);
        let move_file_info = fc::rename_fs(path, new_path).unwrap();
        move_file_info
    }

    #[tauri::command]
    pub fn copy_file_by_from(from: &str) -> String {
        let from_path = Path::new(from);
        let parent_path = from_path.parent().unwrap();
        let mut to_path_name = from_path.file_stem().unwrap().to_str().unwrap().to_string();

        let file_ext = from_path.extension().unwrap();

        while parent_path
            .join(&format!(
                "{}.{}",
                to_path_name.clone(),
                file_ext.to_str().unwrap()
            ))
            .exists()
        {
            to_path_name.push_str(" copy");
        }

        to_path_name.push_str(format!(".{}", file_ext.to_str().unwrap()).as_str());

        let to_path = parent_path.join(&to_path_name);
        fs::copy(from_path, to_path.clone()).unwrap();

        to_path.to_str().unwrap().to_string()
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

        fs::write(file_path, result.to_string()).expect("ERROR");

        String::from("OK")
    }

    #[tauri::command]
    pub fn is_dir(path: &str) -> bool {
        fc::is_dir(path)
    }

    #[tauri::command]
    pub fn get_path_name(path: &str) -> String {
        fc::get_path_name(path)
    }
}
