//! Read declared HTML dependencies without exposing a general filesystem bridge to the frame.
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::{
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
};

const MAX_RESOURCE_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Serialize)]
pub struct PreviewResource {
    content: String,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum PreviewResourceError {
    NotFound,
    PermissionDenied,
    OutsideRoot,
    TooLarge,
    Unsupported,
    ReadFailed,
}

impl From<io::Error> for PreviewResourceError {
    fn from(error: io::Error) -> Self {
        match error.kind() {
            io::ErrorKind::NotFound => Self::NotFound,
            io::ErrorKind::PermissionDenied => Self::PermissionDenied,
            _ => Self::ReadFailed,
        }
    }
}

fn resource_root(
    document_path: &Path,
    workspace_path: Option<&Path>,
) -> Result<PathBuf, PreviewResourceError> {
    let directory = document_path
        .parent()
        .ok_or(PreviewResourceError::Unsupported)?;
    let directory = directory.canonicalize()?;
    if let Some(workspace) = workspace_path.filter(|path| path.is_dir()) {
        let workspace = workspace.canonicalize()?;
        // A loose file in this window must not borrow an unrelated workspace's access.
        let document = document_path.canonicalize()?;
        if document.starts_with(&workspace) && directory.starts_with(&workspace) {
            return Ok(workspace);
        }
    }
    Ok(directory)
}

fn read_resource(
    document_path: &Path,
    resource_path: &Path,
    workspace_path: Option<&Path>,
) -> Result<PreviewResource, PreviewResourceError> {
    let root = resource_root(document_path, workspace_path)?;
    let resource = resource_path.canonicalize()?;
    if !resource.starts_with(&root) {
        return Err(PreviewResourceError::OutsideRoot);
    }
    let file = fs::File::open(resource)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() {
        return Err(PreviewResourceError::Unsupported);
    }
    if metadata.len() > MAX_RESOURCE_BYTES {
        return Err(PreviewResourceError::TooLarge);
    }
    let mut bytes = Vec::new();
    file.take(MAX_RESOURCE_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(PreviewResourceError::from)?;
    if bytes.len() as u64 > MAX_RESOURCE_BYTES {
        return Err(PreviewResourceError::TooLarge);
    }
    Ok(PreviewResource {
        content: STANDARD.encode(bytes),
    })
}

#[tauri::command]
pub async fn read_html_preview_resource(
    window: tauri::WebviewWindow,
    document_path: String,
    resource_path: String,
) -> Result<PreviewResource, PreviewResourceError> {
    // The calling window supplies the scope, never a root chosen by document content.
    let workspace = crate::WINDOW_INSTANCES
        .lock()
        .map_err(|_| PreviewResourceError::ReadFailed)?
        .get(window.label())
        .cloned();
    tauri::async_runtime::spawn_blocking(move || {
        let document = Path::new(&document_path);
        crate::fc::acquire_security_scope(document);
        if let Some(root) = workspace.as_deref().filter(|path| path.is_dir()) {
            crate::fc::acquire_security_scope(root);
        }
        read_resource(document, Path::new(&resource_path), workspace.as_deref())
    })
    .await
    .map_err(|_| PreviewResourceError::ReadFailed)?
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
            read_resource(&doc, &root.join("assets/style.css"), None)
                .unwrap()
                .content,
            STANDARD.encode("body {}")
        );
        assert!(matches!(
            read_resource(&doc, &root.join("../secret"), None),
            Err(PreviewResourceError::OutsideRoot)
        ));
        assert!(read_resource(&doc, &root.join("assets"), None).is_err());
        assert!(matches!(
            read_resource(&doc, &root.join("missing"), None),
            Err(PreviewResourceError::NotFound)
        ));
    }

    #[test]
    fn allows_parent_references_only_within_the_documents_window_workspace() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("site");
        fs::create_dir_all(root.join("pages")).unwrap();
        fs::create_dir_all(root.join("assets")).unwrap();
        let doc = root.join("pages/index.html");
        fs::write(&doc, "<link href='../assets/main.css'>").unwrap();
        let resource = root.join("pages/../assets/main.css");
        fs::write(root.join("assets/main.css"), "body {}").unwrap();
        assert!(read_resource(&doc, &resource, Some(&root)).is_ok());
        assert!(matches!(
            read_resource(&doc, &resource, None),
            Err(PreviewResourceError::OutsideRoot)
        ));

        let other = temp.path().join("site-other");
        fs::create_dir(&other).unwrap();
        fs::write(other.join("secret"), "secret").unwrap();
        assert!(matches!(
            read_resource(&doc, &resource, Some(&other)),
            Err(PreviewResourceError::OutsideRoot)
        ));
        assert!(matches!(
            read_resource(&doc, &other.join("secret"), Some(&root)),
            Err(PreviewResourceError::OutsideRoot)
        ));
    }

    #[test]
    fn exposes_stable_error_codes_without_native_error_text() {
        assert_eq!(
            serde_json::to_value(PreviewResourceError::from(io::Error::from(
                io::ErrorKind::PermissionDenied
            )))
            .unwrap(),
            serde_json::json!({ "code": "permission_denied" })
        );
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
        assert!(matches!(
            read_resource(&doc, &root.join("escape"), None),
            Err(PreviewResourceError::OutsideRoot)
        ));
        fs::File::create(root.join("large"))
            .unwrap()
            .set_len(MAX_RESOURCE_BYTES + 1)
            .unwrap();
        assert!(matches!(
            read_resource(&doc, &root.join("large"), None),
            Err(PreviewResourceError::TooLarge)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn workspace_scope_does_not_follow_resource_or_document_symlinks_outside_it() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path().join("site");
        fs::create_dir_all(root.join("pages")).unwrap();
        fs::write(root.join("asset.css"), "body {}").unwrap();
        fs::write(temp.path().join("outside.html"), "<p>outside</p>").unwrap();
        fs::write(temp.path().join("secret"), "secret").unwrap();
        let doc = root.join("pages/index.html");
        fs::write(&doc, "<p>inside</p>").unwrap();
        std::os::unix::fs::symlink(temp.path().join("secret"), root.join("escape")).unwrap();
        assert!(matches!(
            read_resource(&doc, &root.join("escape"), Some(&root)),
            Err(PreviewResourceError::OutsideRoot)
        ));
        let linked_doc = root.join("pages/linked.html");
        std::os::unix::fs::symlink(temp.path().join("outside.html"), &linked_doc).unwrap();
        assert!(matches!(
            read_resource(&linked_doc, &root.join("asset.css"), Some(&root)),
            Err(PreviewResourceError::OutsideRoot)
        ));
    }
}
