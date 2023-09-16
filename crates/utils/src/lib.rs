use regex::Regex;
use fs_extra;
use std::fs;
use std::path::{Path, PathBuf};

pub fn is_md_file_name(file_name: &str) -> bool {
    let reg = Regex::new(r"\.md$").unwrap();

    reg.is_match(file_name)
}

pub fn move_files(source_paths: &Vec<PathBuf>, dest_path: &Path) {
    let options = fs_extra::dir::CopyOptions::new();
  
    if !dest_path.exists() {
        fs::create_dir(dest_path).expect("Cannot create destination directory");
    }
  
    let dest = dest_path.to_str().unwrap().to_string();
    let mut sources: Vec<String> = Vec::new();
  
    for path in source_paths {
        sources.push(path.to_str().unwrap().to_string());
    }
  
    fs_extra::move_items(&sources, &dest, &options)
        .expect(&format!("Failed to move files to {}", dest));
  }


pub fn get_relative_path(path: &Path, base_path: &Path) -> PathBuf {
    let mut relative_path = PathBuf::new();

    for component in path.components() {
        if component == std::path::Component::Normal("..".as_ref()) {
            relative_path.pop();
        } else if component != std::path::Component::Normal(".".as_ref()) {
            relative_path.push(component);
        }
    }

    relative_path.strip_prefix(base_path).unwrap().to_path_buf()
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_md_file_name() {
        assert!(super::is_md_file_name("test.md"));
        assert!(!super::is_md_file_name("test.txt"));
        assert!(!super::is_md_file_name("test.mdx"));
    }

    #[test]
    fn test_get_relative_path() {
        let path = std::path::Path::new("/a/b/c/d");
        let base_path = std::path::Path::new("/a/b");

        let relative_path = super::get_relative_path(path, base_path);

        assert_eq!(relative_path.to_str().unwrap(), "c/d");
    }
}
