use std::ffi::{OsStr, OsString};
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use tempfile::NamedTempFile;

fn copy_name(name: &OsStr, index: u64) -> OsString {
    if index == 0 {
        return name.to_os_string();
    }

    let path = Path::new(name);
    let mut result = path.file_stem().unwrap_or(name).to_os_string();
    result.push(if index == 1 {
        " copy".to_string()
    } else {
        format!(" copy {index}")
    });
    if let Some(extension) = path.extension() {
        result.push(".");
        result.push(extension);
    }
    result
}

fn stage_copy(reader: &mut impl Read, directory: &Path) -> io::Result<NamedTempFile> {
    let mut temporary = tempfile::Builder::new()
        .prefix(".markflowy-copy-")
        .suffix(".tmp")
        .tempfile_in(directory)?;
    io::copy(reader, temporary.as_file_mut())?;
    temporary.as_file().sync_all()?;
    Ok(temporary)
}

/// Copy saved bytes to a new directory entry. Name selection is enforced by the
/// filesystem, so another process winning a name never causes an overwrite.
pub fn copy_file_without_overwrite(
    from: &Path,
    target_folder: Option<&Path>,
) -> io::Result<PathBuf> {
    let name = from
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "Source has no file name"))?;
    let parent = from
        .parent()
        .filter(|path| !path.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let directory = target_folder.unwrap_or(parent);
    if !fs::metadata(directory)?.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Copy destination must be a directory",
        ));
    }

    let mut source = File::open(from)?;
    if !source.metadata()?.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            "Only regular files can be copied",
        ));
    }
    let mut index = if target_folder.is_none() || same_file::is_same_file(parent, directory)? {
        1
    } else {
        0
    };
    let mut temporary = stage_copy(&mut source, directory)?;

    loop {
        let destination = directory.join(copy_name(name, index));
        match temporary.persist_noclobber(&destination) {
            Ok(_) => return Ok(destination),
            Err(error)
                if error.error.kind() == io::ErrorKind::AlreadyExists
                    || destination.symlink_metadata().is_ok() =>
            {
                temporary = error.file;
                index = index.checked_add(1).ok_or_else(|| {
                    io::Error::new(io::ErrorKind::AlreadyExists, "No available copy name")
                })?;
            }
            Err(error) => return Err(error.error),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::sync::{Arc, Barrier};

    #[test]
    fn duplicates_saved_bytes_with_numbered_names_without_modifying_the_source() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("note.md");
        fs::write(&source, b"saved\r\n\0\xff").unwrap();
        fs::write(directory.path().join("note copy.md"), b"existing").unwrap();

        let second = copy_file_without_overwrite(&source, None).unwrap();
        let third = copy_file_without_overwrite(&source, Some(directory.path())).unwrap();

        assert_eq!(second.file_name().unwrap(), "note copy 2.md");
        assert_eq!(third.file_name().unwrap(), "note copy 3.md");
        assert_eq!(fs::read(second).unwrap(), b"saved\r\n\0\xff");
        assert_eq!(fs::read(third).unwrap(), b"saved\r\n\0\xff");
        assert_eq!(fs::read(source).unwrap(), b"saved\r\n\0\xff");
        assert_eq!(
            fs::read(directory.path().join("note copy.md")).unwrap(),
            b"existing"
        );
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 4);
    }

    #[test]
    fn copies_to_another_directory_preserving_the_name_until_it_collides() {
        let source_dir = tempfile::tempdir().unwrap();
        let target_dir = tempfile::tempdir().unwrap();
        let source = source_dir.path().join("笔记.v1.md");
        fs::write(&source, "已保存内容").unwrap();

        for expected in ["笔记.v1.md", "笔记.v1 copy.md", "笔记.v1 copy 2.md"] {
            let copied = copy_file_without_overwrite(&source, Some(target_dir.path())).unwrap();
            assert_eq!(copied, target_dir.path().join(expected));
            assert_eq!(fs::read_to_string(copied).unwrap(), "已保存内容");
        }
        assert_eq!(fs::read_dir(source_dir.path()).unwrap().count(), 1);
        assert_eq!(fs::read_dir(target_dir.path()).unwrap().count(), 3);
    }

    #[test]
    fn supports_extensionless_files_and_dotfiles() {
        let directory = tempfile::tempdir().unwrap();
        for (name, expected) in [("LICENSE", "LICENSE copy"), (".env", ".env copy")] {
            let source = directory.path().join(name);
            fs::write(&source, b"content").unwrap();
            assert_eq!(
                copy_file_without_overwrite(&source, None).unwrap(),
                directory.path().join(expected)
            );
        }
    }

    #[test]
    fn concurrent_copies_never_overwrite_each_other_or_existing_entries() {
        let source_dir = tempfile::tempdir().unwrap();
        let target_dir = tempfile::tempdir().unwrap();
        fs::write(target_dir.path().join("note.md"), b"original").unwrap();
        fs::create_dir(target_dir.path().join("note copy.md")).unwrap();
        let barrier = Arc::new(Barrier::new(8));
        let copies: Vec<_> = (0..8)
            .map(|index| {
                let parent = source_dir.path().join(index.to_string());
                fs::create_dir(&parent).unwrap();
                let source = parent.join("note.md");
                let content = format!("source {index}");
                fs::write(&source, &content).unwrap();
                let destination = target_dir.path().to_path_buf();
                let barrier = Arc::clone(&barrier);
                std::thread::spawn(move || {
                    barrier.wait();
                    let copied = copy_file_without_overwrite(&source, Some(&destination)).unwrap();
                    assert_eq!(fs::read_to_string(&copied).unwrap(), content);
                    copied
                })
            })
            .collect();
        let paths: HashSet<_> = copies
            .into_iter()
            .map(|copy| copy.join().unwrap())
            .collect();
        assert_eq!(paths.len(), 8);
        assert_eq!(
            fs::read(target_dir.path().join("note.md")).unwrap(),
            b"original"
        );
        assert!(target_dir.path().join("note copy.md").is_dir());
        assert_eq!(fs::read_dir(target_dir.path()).unwrap().count(), 10);
    }

    #[test]
    fn invalid_sources_and_destinations_leave_no_files_behind() {
        let directory = tempfile::tempdir().unwrap();
        let source = directory.path().join("note.md");
        fs::write(&source, b"content").unwrap();

        assert!(copy_file_without_overwrite(&directory.path().join("missing.md"), None).is_err());
        assert!(copy_file_without_overwrite(directory.path(), None).is_err());
        assert!(copy_file_without_overwrite(&source, Some(&source)).is_err());
        assert!(
            copy_file_without_overwrite(&source, Some(&directory.path().join("missing"))).is_err()
        );
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn read_failure_removes_the_partial_temporary_file() {
        struct FailingReader(bool);
        impl Read for FailingReader {
            fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
                if self.0 {
                    return Err(io::Error::new(
                        io::ErrorKind::PermissionDenied,
                        "Read failed",
                    ));
                }
                self.0 = true;
                buffer[0] = b'x';
                Ok(1)
            }
        }

        let directory = tempfile::tempdir().unwrap();
        assert!(stage_copy(&mut FailingReader(false), directory.path()).is_err());
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 0);
    }

    #[cfg(unix)]
    #[test]
    fn directory_aliases_and_existing_symlinks_cannot_overwrite_the_source() {
        use std::os::unix::fs::symlink;

        let directory = tempfile::tempdir().unwrap();
        let source_dir = directory.path().join("source");
        fs::create_dir(&source_dir).unwrap();
        let source = source_dir.join("note.md");
        fs::write(&source, "source").unwrap();
        let alias = directory.path().join("alias");
        symlink(&source_dir, &alias).unwrap();
        symlink(&source, source_dir.join("note copy.md")).unwrap();
        symlink(
            source_dir.join("missing"),
            source_dir.join("note copy 2.md"),
        )
        .unwrap();

        let copied = copy_file_without_overwrite(&source, Some(&alias)).unwrap();
        assert_eq!(copied.file_name().unwrap(), "note copy 3.md");
        assert_eq!(fs::read_to_string(&source).unwrap(), "source");
        assert!(source_dir.join("note copy.md").is_symlink());
        assert!(source_dir.join("note copy 2.md").is_symlink());
    }
}
