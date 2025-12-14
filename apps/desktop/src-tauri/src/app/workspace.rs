use std::path::PathBuf;

/// 检查指定路径是否为 git 仓库
///
/// # Arguments
///
/// * `path` - 要检查的路径字符串
///
/// # Returns
///
/// 返回 `Result<bool, String>`，其中：
/// - `Ok(true)` 表示是 git 仓库
/// - `Ok(false)` 表示不是 git 仓库
/// - `Err(String)` 表示检查过程中发生错误
pub fn is_git_repository(path: &str) -> Result<bool, String> {
    let path_buf = PathBuf::from(path);

    // 检查路径是否存在
    if !path_buf.exists() {
        return Err(format!("路径不存在: {}", path));
    }

    // 检查是否为目录
    if !path_buf.is_dir() {
        return Ok(false);
    }

    // 检查是否存在 .git 目录
    let git_dir = path_buf.join(".git");
    if !git_dir.exists() {
        return Ok(false);
    }

    // 检查 .git 是否为目录
    if !git_dir.is_dir() {
        return Ok(false);
    }

    // 检查 .git 目录中是否有必要的文件/目录来确认这是一个有效的 git 仓库
    // 通常 git 仓库会有以下文件之一：
    // - HEAD 文件
    // - config 文件
    // - objects 目录
    // - refs 目录

    let has_head = git_dir.join("HEAD").exists();
    let has_config = git_dir.join("config").exists();
    let has_objects = git_dir.join("objects").is_dir();
    let has_refs = git_dir.join("refs").is_dir();

    // 如果至少有一个必要的文件/目录存在，则认为是有效的 git 仓库
    if has_head || has_config || has_objects || has_refs {
        Ok(true)
    } else {
        Ok(false)
    }
}

pub mod cmd {
    use tauri::command;

    #[command]
    pub async fn is_git_repository(path: &str) -> Result<bool, String> {
        crate::app::workspace::is_git_repository(path)
    }
}
