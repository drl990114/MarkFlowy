//! Read declared HTML dependencies without exposing a general filesystem bridge to the frame.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::{fs, io::Read, path::Path};

const MAX_RESOURCE_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Serialize)]
pub struct PreviewResource {
    content: String,
}

fn read_resource(document_path: &Path, resource_path: &Path) -> Result<PreviewResource, String> {
    let directory = document_path.parent().ok_or("Missing document directory")?;
    let root = directory.canonicalize().map_err(|e| e.to_string())?;
    let resource = resource_path.canonicalize().map_err(|e| e.to_string())?;
    if !resource.starts_with(&root) {
        return Err("Resource is outside the document directory".into());
    }
    let file = fs::File::open(resource).map_err(|e| e.to_string())?;
    let metadata = file.metadata().map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.len() > MAX_RESOURCE_BYTES {
        return Err("Resource is not a file or exceeds 16 MiB".into());
    }
    let mut bytes = Vec::new();
    file.take(MAX_RESOURCE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_RESOURCE_BYTES {
        return Err("Resource exceeds 16 MiB".into());
    }
    Ok(PreviewResource {
        content: STANDARD.encode(bytes),
    })
}

#[tauri::command]
pub async fn read_html_preview_resource(
    document_path: String,
    resource_path: String,
) -> Result<PreviewResource, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let document = Path::new(&document_path);
        crate::fc::acquire_security_scope(document);
        read_resource(document, Path::new(&resource_path))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn allows_descendants_but_rejects_parent_and_sibling_paths() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("site");
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("assets/style.css"), "body {}").unwrap();
        fs::write(temp.path().join("secret"), "secret").unwrap();
        let doc = root.join("index.html");
        assert_eq!(
            read_resource(&doc, &root.join("assets/style.css"))
                .unwrap()
                .content,
            STANDARD.encode("body {}")
        );
        assert!(read_resource(&doc, &root.join("../secret")).is_err());
        assert!(read_resource(&doc, &root.join("assets")).is_err());
        assert!(read_resource(&doc, &root.join("missing")).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape_and_large_resources() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("site");
        fs::create_dir(&root).unwrap();
        fs::write(temp.path().join("secret"), "secret").unwrap();
        std::os::unix::fs::symlink(temp.path().join("secret"), root.join("escape")).unwrap();
        let doc = root.join("index.html");
        assert!(read_resource(&doc, &root.join("escape")).is_err());
        fs::File::create(root.join("large"))
            .unwrap()
            .set_len(MAX_RESOURCE_BYTES + 1)
            .unwrap();
        assert!(read_resource(&doc, &root.join("large")).is_err());
    }
}
