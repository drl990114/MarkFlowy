use crate::{
  fc,
};

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
pub fn open_folder(folder_path: &str) -> String {
    let files = fc::files_to_json(fc::read_directory(folder_path));
    files
}

#[tauri::command]
pub fn get_file_content(file_path: &str) -> String {
    let content = fc::read_file(file_path);
    content
}

#[tauri::command]
pub fn write_file(file_path: &str, content: &str) -> String {
    fc::write_file(file_path, content);
    String::from("OK")
}
