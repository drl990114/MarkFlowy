use serde::{Deserialize, Serialize};
use anyhow::Result as AnyResult;
use std::fs;
use std::path::Path;

// #[warn(dead_code)]
#[derive(Serialize, Deserialize, Debug)]
pub struct FileInfo {
    name: String,
    kind: String,
    path: String,
    children: Vec<FileInfo>,
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

pub fn read_directory(dir_path: &str) -> Vec<FileInfo> {
    let new_path = Path::new(dir_path);
    println!("new path {:?}", new_path);
    let paths = fs::read_dir(new_path).unwrap();

    let mut files: Vec<FileInfo> = Vec::new();

    for path in paths {
        let path_unwrap = path.unwrap();
        let meta = path_unwrap.metadata();
        let meta_unwrap = meta.unwrap();

        let mut kind = String::from("file");

        let mut children: Vec<FileInfo> = Vec::new();

        let filename = match path_unwrap.file_name().into_string() {
            Ok(str) => str,
            Err(error) => String::from("ERROR"),
        };

        let file_path = dir_path.to_owned() + "/" + &filename;

        if meta_unwrap.is_dir() {
            kind = String::from("dir");
            children = read_directory(&file_path);
        }

        let new_file_info = FileInfo {
            name: filename,
            kind,
            path: file_path,
            children,
        };

        files.push(new_file_info);
    }

    files
}

pub fn files_to_json(files: Vec<FileInfo>) -> String {
    let files_str = match serde_json::to_string(&files) {
        Ok(str) => str,
        Err(error) => panic!("Problem opening the file: {:?}", error),
    };

    files_str
}

pub fn read_file(path: &str) -> String {
    let contents = fs::read_to_string(path).expect("ERROR");
    contents
}

// update file and create new file
pub fn write_file(path: &str, content: &str) -> String {
    let file_path = Path::new(path);
    let result = match fs::write(file_path, content) {
        Ok(()) => String::from("OK"),
        Err(_err) => String::from("ERROR"),
    };

    result
}

pub fn exists(path: &Path) -> bool {
    Path::new(path).exists()
}

pub fn create_file<P: AsRef<Path>>(filename: P) -> AnyResult<()> {
    let filename = filename.as_ref();
    if let Some(parent) = filename.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }
    fs::File::create(filename)?;
    Ok(())
}

// pub fn create_directory(path: &str) -> SerdeResult<()> {
//     let dir_path = Path::new(path);
//     fs::create_dir(dir_path);
//     Ok(())
// }

// pub fn remove_file(path: &str) -> SerdeResult<()> {
//     let file_path = Path::new(path);
//     fs::remove_file(file_path);
//     Ok(())
// }

// pub fn remove_folder(path: &str) -> SerdeResult<()> {
//     let folder_path = Path::new(path);
//     fs::remove_dir_all(folder_path);
//     Ok(())
// }
