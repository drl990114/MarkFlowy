use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

const MAX_SUMMARY_ENTRIES: u64 = 100_000;
const MAX_SUMMARY_DURATION: Duration = Duration::from_secs(2);

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderDeletionSummary {
    pub files: u64,
    pub folders: u64,
    pub complete: bool,
    pub is_symlink: bool,
}

#[derive(Clone, Copy)]
struct SummaryLimits {
    entries: u64,
    duration: Duration,
}

fn normalized_folder_path(path: &Path) -> PathBuf {
    // A trailing separator would make symlink_metadata follow a directory link
    // on Unix. Rebuild components without resolving links or parent segments.
    path.components().collect()
}

fn summarize_folder_with_limits(
    folder_path: &Path,
    limits: SummaryLimits,
) -> Result<FolderDeletionSummary, String> {
    let started_at = Instant::now();
    let folder_path = normalized_folder_path(folder_path);
    let metadata = fs::symlink_metadata(&folder_path)
        .map_err(|error| format!("Failed to inspect {}: {error}", folder_path.display()))?;
    let mut summary = FolderDeletionSummary {
        files: 0,
        folders: 0,
        complete: true,
        is_symlink: metadata.file_type().is_symlink(),
    };

    if summary.is_symlink {
        return Ok(summary);
    }
    if !metadata.is_dir() {
        return Err(format!("{} is not a folder", folder_path.display()));
    }

    let mut pending_folders = vec![folder_path];
    let mut visited_entries = 0;
    while let Some(path) = pending_folders.pop() {
        if started_at.elapsed() >= limits.duration {
            summary.complete = false;
            return Ok(summary);
        }

        // A queued directory may have been replaced while its siblings were
        // scanned. Inspect it again so a replacement link is never traversed.
        let metadata = fs::symlink_metadata(&path)
            .map_err(|error| format!("Failed to inspect {}: {error}", path.display()))?;
        if metadata.file_type().is_symlink() {
            continue;
        }
        if !metadata.is_dir() {
            return Err(format!("{} is no longer a folder", path.display()));
        }

        let entries = fs::read_dir(&path)
            .map_err(|error| format!("Failed to read {}: {error}", path.display()))?;
        for entry in entries {
            if visited_entries >= limits.entries || started_at.elapsed() >= limits.duration {
                summary.complete = false;
                return Ok(summary);
            }
            let entry = entry.map_err(|error| {
                format!("Failed to read an entry in {}: {error}", path.display())
            })?;
            let file_type = entry.file_type().map_err(|error| {
                format!("Failed to inspect {}: {error}", entry.path().display())
            })?;
            visited_entries += 1;
            if file_type.is_dir() {
                summary.folders += 1;
                pending_folders.push(entry.path());
            } else {
                // Links (including dangling links) and other non-directory
                // entries are removed as entries, without scanning a target.
                summary.files += 1;
            }
        }
    }

    Ok(summary)
}

#[tauri::command]
pub async fn summarize_folder_for_deletion(
    folder_path: String,
) -> Result<FolderDeletionSummary, String> {
    tokio::task::spawn_blocking(move || {
        let path = normalized_folder_path(Path::new(&folder_path));
        crate::fc::ensure_workspace_scope_active(&path);
        summarize_folder_with_limits(
            &path,
            SummaryLimits {
                entries: MAX_SUMMARY_ENTRIES,
                duration: MAX_SUMMARY_DURATION,
            },
        )
    })
    .await
    .map_err(|error| format!("Folder summary task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn summarize(path: &Path) -> Result<FolderDeletionSummary, String> {
        summarize_folder_with_limits(
            path,
            SummaryLimits {
                entries: MAX_SUMMARY_ENTRIES,
                duration: MAX_SUMMARY_DURATION,
            },
        )
    }

    #[test]
    fn empty_folder_excludes_the_root() {
        let directory = TempDir::new().unwrap();
        assert_eq!(
            summarize(directory.path()).unwrap(),
            FolderDeletionSummary {
                files: 0,
                folders: 0,
                complete: true,
                is_symlink: false,
            }
        );
    }

    #[test]
    fn includes_nested_hidden_and_unsupported_entries_without_filters() {
        let directory = TempDir::new().unwrap();
        fs::create_dir_all(directory.path().join("nested/deeper")).unwrap();
        fs::create_dir(directory.path().join(".hidden")).unwrap();
        fs::create_dir(directory.path().join("node_modules")).unwrap();
        for name in [
            "note.md",
            "archive.bin",
            ".secret",
            "nested/deeper/image.png",
            ".hidden/settings.json",
            "node_modules/package.js",
        ] {
            fs::write(directory.path().join(name), b"test").unwrap();
        }

        assert_eq!(
            summarize(directory.path()).unwrap(),
            FolderDeletionSummary {
                files: 6,
                folders: 4,
                complete: true,
                is_symlink: false,
            }
        );
    }

    #[test]
    fn entry_limit_returns_a_lower_bound() {
        let directory = TempDir::new().unwrap();
        for name in ["one.md", "two.md", "three.md"] {
            fs::write(directory.path().join(name), b"test").unwrap();
        }
        let summary = summarize_folder_with_limits(
            directory.path(),
            SummaryLimits {
                entries: 2,
                duration: MAX_SUMMARY_DURATION,
            },
        )
        .unwrap();
        assert_eq!(summary.files, 2);
        assert_eq!(summary.folders, 0);
        assert!(!summary.complete);
    }

    #[test]
    fn exact_entry_limit_can_complete() {
        let directory = TempDir::new().unwrap();
        fs::write(directory.path().join("one.md"), b"test").unwrap();
        let summary = summarize_folder_with_limits(
            directory.path(),
            SummaryLimits {
                entries: 1,
                duration: MAX_SUMMARY_DURATION,
            },
        )
        .unwrap();
        assert_eq!(summary.files, 1);
        assert!(summary.complete);
    }

    #[test]
    fn duration_limit_returns_incomplete_without_false_empty_claim() {
        let directory = TempDir::new().unwrap();
        fs::write(directory.path().join("one.md"), b"test").unwrap();
        let summary = summarize_folder_with_limits(
            directory.path(),
            SummaryLimits {
                entries: MAX_SUMMARY_ENTRIES,
                duration: Duration::ZERO,
            },
        )
        .unwrap();
        assert_eq!(summary.files, 0);
        assert!(!summary.complete);
    }

    #[test]
    fn rejects_missing_and_regular_file_roots() {
        let directory = TempDir::new().unwrap();
        assert!(summarize(&directory.path().join("missing")).is_err());
        let file = directory.path().join("file.md");
        fs::write(&file, b"test").unwrap();
        assert!(summarize(&file).unwrap_err().contains("not a folder"));
    }

    #[cfg(unix)]
    #[test]
    fn unreadable_descendants_reject_instead_of_returning_partial_counts() {
        use std::os::unix::fs::PermissionsExt;

        let directory = TempDir::new().unwrap();
        let blocked = directory.path().join("blocked");
        fs::create_dir(&blocked).unwrap();
        fs::write(blocked.join("hidden.md"), b"test").unwrap();
        fs::set_permissions(&blocked, fs::Permissions::from_mode(0o000)).unwrap();
        // Privileged test processes can bypass permissions. Restore access
        // before leaving so TempDir can clean up in either environment.
        let permissions_enforced = fs::read_dir(&blocked).is_err();
        let result = summarize(directory.path());
        fs::set_permissions(&blocked, fs::Permissions::from_mode(0o700)).unwrap();
        if permissions_enforced {
            assert!(result.unwrap_err().contains("Failed to read"));
        }
    }

    #[cfg(unix)]
    #[test]
    fn child_links_count_as_entries_without_traversing_targets() {
        use std::os::unix::fs::symlink;

        let directory = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        fs::write(outside.path().join("outside.md"), b"test").unwrap();
        symlink(outside.path(), directory.path().join("folder-link")).unwrap();
        symlink(
            outside.path().join("outside.md"),
            directory.path().join("file-link"),
        )
        .unwrap();
        symlink(
            outside.path().join("missing"),
            directory.path().join("broken"),
        )
        .unwrap();
        symlink(directory.path(), directory.path().join("loop")).unwrap();

        let summary = summarize(directory.path()).unwrap();
        assert_eq!(summary.files, 4);
        assert_eq!(summary.folders, 0);
        assert!(summary.complete);
        assert!(!summary.is_symlink);
    }

    #[cfg(unix)]
    #[test]
    fn root_links_return_zero_without_traversing_even_with_trailing_separator() {
        use std::os::unix::fs::symlink;

        let directory = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        fs::write(outside.path().join("outside.md"), b"test").unwrap();
        let link = directory.path().join("folder-link");
        symlink(outside.path(), &link).unwrap();

        for root in [link.clone(), link.join(""), link.join(".")] {
            assert_eq!(
                summarize(&root).unwrap(),
                FolderDeletionSummary {
                    files: 0,
                    folders: 0,
                    complete: true,
                    is_symlink: true,
                }
            );
        }
        let broken = directory.path().join("broken-link");
        symlink(outside.path().join("missing"), &broken).unwrap();
        assert!(summarize(&broken).unwrap().is_symlink);
    }

    #[test]
    fn serializes_the_frontend_schema() {
        let value = serde_json::to_value(FolderDeletionSummary {
            files: 2,
            folders: 3,
            complete: false,
            is_symlink: true,
        })
        .unwrap();
        assert_eq!(
            value,
            serde_json::json!({
                "files": 2,
                "folders": 3,
                "complete": false,
                "isSymlink": true,
            })
        );
    }
}
