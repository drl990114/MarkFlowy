use super::*;

fn target(directory: &Path, name: &str) -> BookmarkTarget {
    BookmarkTarget::LocalFile {
        path: directory.join(name).to_string_lossy().into_owned(),
    }
}

fn create(directory: &Path, name: &str) -> BookmarkMutation {
    BookmarkMutation::Create {
        input: BookmarkInput {
            title: name.into(),
            target: target(directory, name),
            tags: vec!["work".into()],
        },
    }
}

fn legacy_bytes(directory: &Path) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!({
        "version": "0.0.1",
        "bookmarks": [
            {"id": "old-a", "title": "Zebra", "path": directory.join("missing-a.md"), "tags": ["work"]},
            {"id": "old-b", "title": "Alpha", "path": directory.join("missing-b.md"), "tags": []}
        ]
    }))
    .unwrap()
}

#[test]
fn starts_empty_without_writing_until_first_mutation() {
    let directory = tempfile::tempdir().unwrap();
    let loaded = load_document(directory.path(), 100).unwrap();
    assert_eq!(loaded.document.library(), BookmarkLibrary::default());
    assert_eq!(loaded.warning, None);
    assert!(!directory.path().join(LIBRARY_FILE).exists());
}

#[test]
fn crud_preserves_created_at_and_missing_targets() {
    let directory = tempfile::tempdir().unwrap();
    let first = mutate_document(
        directory.path(),
        0,
        create(directory.path(), "first.md"),
        100,
    )
    .unwrap();
    assert_eq!(first.revision, 1);
    assert_eq!(first.items[0].created_at, 100);
    assert!(uuid::Uuid::parse_str(&first.items[0].id).is_ok());
    assert!(!Path::new(first.items[0].target.path()).exists());
    let id = first.items[0].id.clone();
    let updated = mutate_document(
        directory.path(),
        1,
        BookmarkMutation::Update {
            id: id.clone(),
            changes: BookmarkChanges {
                title: " Renamed ".into(),
                tags: vec!["new".into(), " new ".into()],
            },
        },
        200,
    )
    .unwrap();
    assert_eq!(updated.items[0].title, "Renamed");
    assert_eq!(updated.items[0].tags, vec!["new"]);
    assert_eq!(updated.items[0].created_at, 100);
    assert_eq!(updated.items[0].target, first.items[0].target);
    let saved_bytes = fs::read(directory.path().join(LIBRARY_FILE)).unwrap();
    let loaded = load_document(directory.path(), 300).unwrap();
    assert_eq!(loaded.document.library(), updated);
    assert_eq!(
        fs::read(directory.path().join(LIBRARY_FILE)).unwrap(),
        saved_bytes
    );
    let deleted =
        mutate_document(directory.path(), 2, BookmarkMutation::Delete { id }, 400).unwrap();
    assert_eq!(deleted.revision, 3);
    assert!(deleted.items.is_empty());
}

#[test]
fn rejects_stale_writes_duplicate_targets_and_unknown_ids_without_changing_disk() {
    let directory = tempfile::tempdir().unwrap();
    mutate_document(
        directory.path(),
        0,
        create(directory.path(), "first.md"),
        100,
    )
    .unwrap();
    let before = fs::read(directory.path().join(LIBRARY_FILE)).unwrap();
    for (revision, mutation, code) in [
        (0, create(directory.path(), "second.md"), "conflict"),
        (1, create(directory.path(), "first.md"), "duplicateTarget"),
        (
            1,
            BookmarkMutation::Delete {
                id: "unknown".into(),
            },
            "notFound",
        ),
        (
            1,
            BookmarkMutation::Update {
                id: "unknown".into(),
                changes: BookmarkChanges {
                    title: "title".into(),
                    tags: vec![],
                },
            },
            "notFound",
        ),
    ] {
        assert_eq!(
            mutate_document(directory.path(), revision, mutation, 200)
                .unwrap_err()
                .code,
            code
        );
        assert_eq!(
            fs::read(directory.path().join(LIBRARY_FILE)).unwrap(),
            before
        );
    }
}

#[test]
fn invalid_input_does_not_create_a_library() {
    let directory = tempfile::tempdir().unwrap();
    for (title, path) in [
        (" ", directory.path().join("file.md")),
        ("Title", "relative.md".into()),
    ] {
        let error = mutate_document(
            directory.path(),
            0,
            BookmarkMutation::Create {
                input: BookmarkInput {
                    title: title.into(),
                    target: BookmarkTarget::LocalFile {
                        path: path.to_string_lossy().into_owned(),
                    },
                    tags: vec![],
                },
            },
            100,
        )
        .unwrap_err();
        assert_eq!(error.code, "invalid");
        assert!(!directory.path().join(LIBRARY_FILE).exists());
    }
}

#[test]
fn clients_cannot_set_identity_timestamp_target_on_edit_or_migration_metadata() {
    for mutation in [
        serde_json::json!({"type":"create","input":{"title":"Title","target":{"kind":"localFile","path":"/file.md"},"tags":[],"createdAt":1}}),
        serde_json::json!({"type":"update","id":"a","changes":{"title":"Title","tags":[],"target":{"kind":"localFile","path":"/file.md"}}}),
        serde_json::json!({"type":"delete","id":"a","migration":{"sourceSha256":"a"}}),
    ] {
        assert!(serde_json::from_value::<BookmarkMutation>(mutation).is_err());
    }
}

#[test]
fn migration_preserves_every_item_and_uses_one_timestamp_before_deleting_legacy() {
    let directory = tempfile::tempdir().unwrap();
    let legacy = directory.path().join(LEGACY_FILE);
    let bytes = legacy_bytes(directory.path());
    fs::write(&legacy, &bytes).unwrap();
    let loaded = load_document(directory.path(), 1234).unwrap();
    assert!(loaded.warning.is_none());
    assert!(!legacy.exists());
    assert_eq!(loaded.document.revision, 1);
    assert_eq!(loaded.document.items.len(), 2);
    assert_eq!(loaded.document.items[0].id, "old-a");
    assert_eq!(loaded.document.items[0].title, "Zebra");
    assert_eq!(loaded.document.items[1].id, "old-b");
    assert!(loaded
        .document
        .items
        .iter()
        .all(|item| item.created_at == 1234));
    assert!(loaded
        .document
        .items
        .iter()
        .all(|item| !Path::new(item.target.path()).exists()));
    assert_eq!(
        loaded.document.migration.as_ref().unwrap().source_sha256,
        source_hash(&bytes)
    );
    assert_eq!(
        read_document(&directory.path().join(LIBRARY_FILE))
            .unwrap()
            .unwrap(),
        loaded.document
    );
    let dto = serde_json::to_value(BookmarkLoadResult {
        library: loaded.document.library(),
        warning: loaded.warning,
    })
    .unwrap();
    assert!(dto["library"].get("migration").is_none());
    assert_eq!(dto["library"]["schemaVersion"], 1);
    assert!(dto["warning"].is_null());
    assert_eq!(
        load_document(directory.path(), 9999)
            .unwrap()
            .document
            .items[0]
            .created_at,
        1234
    );
}

#[test]
fn empty_legacy_library_is_migrated_without_repeated_imports() {
    let directory = tempfile::tempdir().unwrap();
    fs::write(
        directory.path().join(LEGACY_FILE),
        r#"{"version":"0.0.1","bookmarks":[]}"#,
    )
    .unwrap();
    let loaded = load_document(directory.path(), 123).unwrap();
    assert!(loaded.document.items.is_empty());
    assert!(loaded.document.migration.is_some());
    assert!(!directory.path().join(LEGACY_FILE).exists());
}

#[test]
fn restart_after_publish_only_cleans_matching_source_and_keeps_new_edits() {
    let directory = tempfile::tempdir().unwrap();
    let bytes = legacy_bytes(directory.path());
    fs::write(directory.path().join(LEGACY_FILE), &bytes).unwrap();
    let mut document = migrate_legacy(&bytes, 100).unwrap();
    document
        .apply(
            BookmarkMutation::Update {
                id: "old-a".into(),
                changes: BookmarkChanges {
                    title: "New edit".into(),
                    tags: vec![],
                },
            },
            200,
        )
        .unwrap();
    write_document(&directory.path().join(LIBRARY_FILE), &document, true).unwrap();
    let loaded = load_document(directory.path(), 300).unwrap();
    assert_eq!(loaded.document, document);
    assert!(loaded.warning.is_none());
    assert!(!directory.path().join(LEGACY_FILE).exists());
    assert_eq!(loaded.document.items[0].title, "New edit");
    assert_eq!(loaded.document.items[0].created_at, 100);
}

#[test]
fn changed_or_unowned_legacy_source_is_never_merged_or_deleted() {
    let directory = tempfile::tempdir().unwrap();
    let legacy_path = directory.path().join(LEGACY_FILE);
    let bytes = legacy_bytes(directory.path());
    fs::write(&legacy_path, &bytes).unwrap();
    let mut document = migrate_legacy(&bytes, 100).unwrap();
    write_document(&directory.path().join(LIBRARY_FILE), &document, true).unwrap();
    let changed = [bytes.clone(), b"\n".to_vec()].concat();
    fs::write(&legacy_path, &changed).unwrap();
    let loaded = load_document(directory.path(), 200).unwrap();
    assert_eq!(loaded.document, document);
    assert_eq!(loaded.warning.unwrap().code, "legacyConflict");
    assert_eq!(fs::read(&legacy_path).unwrap(), changed);
    document.migration = None;
    write_document(&directory.path().join(LIBRARY_FILE), &document, false).unwrap();
    fs::write(&legacy_path, &bytes).unwrap();
    let loaded = load_document(directory.path(), 300).unwrap();
    assert_eq!(loaded.warning.unwrap().code, "legacyConflict");
    assert_eq!(fs::read(&legacy_path).unwrap(), bytes);
}

#[test]
fn cleanup_failure_keeps_valid_library_and_can_retry_without_remigration() {
    let directory = tempfile::tempdir().unwrap();
    let bytes = legacy_bytes(directory.path());
    fs::write(directory.path().join(LEGACY_FILE), &bytes).unwrap();
    let document = migrate_legacy(&bytes, 100).unwrap();
    write_document(&directory.path().join(LIBRARY_FILE), &document, true).unwrap();
    let warning = cleanup_legacy(directory.path(), &document, |_| {
        Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "simulated cleanup denial",
        ))
    })
    .unwrap();
    assert_eq!(warning.code, "cleanupFailed");
    assert_eq!(fs::read(directory.path().join(LEGACY_FILE)).unwrap(), bytes);
    assert_eq!(
        read_document(&directory.path().join(LIBRARY_FILE))
            .unwrap()
            .unwrap(),
        document
    );
    let retry = load_document(directory.path(), 999).unwrap();
    assert_eq!(retry.document, document);
    assert!(retry.warning.is_none());
    assert!(!directory.path().join(LEGACY_FILE).exists());
}

#[test]
fn normal_mutations_retain_migration_receipt_without_exposing_it() {
    let directory = tempfile::tempdir().unwrap();
    let bytes = legacy_bytes(directory.path());
    fs::write(directory.path().join(LEGACY_FILE), &bytes).unwrap();
    load_document(directory.path(), 100).unwrap();
    let library =
        mutate_document(directory.path(), 1, create(directory.path(), "new.md"), 200).unwrap();
    assert_eq!(library.items.len(), 3);
    assert!(serde_json::to_value(library)
        .unwrap()
        .get("migration")
        .is_none());
    assert_eq!(
        read_document(&directory.path().join(LIBRARY_FILE))
            .unwrap()
            .unwrap()
            .migration
            .unwrap()
            .source_sha256,
        source_hash(&bytes)
    );
}

#[test]
fn malformed_or_future_new_documents_block_migration_without_changing_either_file() {
    let directory = tempfile::tempdir().unwrap();
    let bytes = legacy_bytes(directory.path());
    fs::write(directory.path().join(LEGACY_FILE), &bytes).unwrap();
    for (content, code) in [
        ("{broken", "invalid"),
        (
            r#"{"schemaVersion":2,"otherFutureField":true}"#,
            "unsupportedVersion",
        ),
        (
            r#"{"schemaVersion":1,"revision":0,"items":[],"unexpected":true}"#,
            "invalid",
        ),
    ] {
        fs::write(directory.path().join(LIBRARY_FILE), content).unwrap();
        let error = load_document(directory.path(), 100).err().unwrap();
        assert_eq!(error.code, code);
        assert_eq!(fs::read(directory.path().join(LEGACY_FILE)).unwrap(), bytes);
        assert_eq!(
            fs::read_to_string(directory.path().join(LIBRARY_FILE)).unwrap(),
            content
        );
    }
}

#[test]
fn invalid_legacy_data_never_creates_a_destination_or_deletes_the_source() {
    let directory = tempfile::tempdir().unwrap();
    let original: serde_json::Value =
        serde_json::from_slice(&legacy_bytes(directory.path())).unwrap();
    let mut duplicate_id = original.clone();
    duplicate_id["bookmarks"][1]["id"] = duplicate_id["bookmarks"][0]["id"].clone();
    let mut duplicate_target = original.clone();
    duplicate_target["bookmarks"][1]["path"] = duplicate_target["bookmarks"][0]["path"].clone();
    let mut empty_title = original.clone();
    empty_title["bookmarks"][0]["title"] = serde_json::json!(" ");
    let mut future = original;
    future["version"] = serde_json::json!("0.0.2");
    for bytes in [
        b"{broken".to_vec(),
        serde_json::to_vec(&duplicate_id).unwrap(),
        serde_json::to_vec(&duplicate_target).unwrap(),
        serde_json::to_vec(&empty_title).unwrap(),
        serde_json::to_vec(&future).unwrap(),
    ] {
        fs::write(directory.path().join(LEGACY_FILE), &bytes).unwrap();
        assert!(load_document(directory.path(), 100).is_err());
        assert!(!directory.path().join(LIBRARY_FILE).exists());
        assert_eq!(fs::read(directory.path().join(LEGACY_FILE)).unwrap(), bytes);
    }
}

#[test]
fn initial_publication_never_overwrites_an_existing_library() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join(LIBRARY_FILE);
    let mut original = BookmarkDocument::default();
    original
        .apply(create(directory.path(), "existing.md"), 100)
        .unwrap();
    write_document(&path, &original, true).unwrap();
    let bytes = fs::read(&path).unwrap();
    let replacement = migrate_legacy(&legacy_bytes(directory.path()), 200).unwrap();
    assert_eq!(
        write_document(&path, &replacement, true)
            .unwrap_err()
            .kind(),
        io::ErrorKind::AlreadyExists
    );
    assert_eq!(fs::read(&path).unwrap(), bytes);
}

#[test]
fn failed_publication_leaves_legacy_intact_and_cleans_staged_file() {
    let directory = tempfile::tempdir().unwrap();
    let legacy = directory.path().join(LEGACY_FILE);
    let bytes = legacy_bytes(directory.path());
    fs::write(&legacy, &bytes).unwrap();
    let path = directory.path().join(LIBRARY_FILE);
    fs::create_dir(&path).unwrap();
    let document = migrate_legacy(&bytes, 100).unwrap();
    assert!(write_document(&path, &document, false).is_err());
    assert_eq!(fs::read(&legacy).unwrap(), bytes);
    assert!(path.is_dir());
    assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 2);
}

#[test]
fn unsafe_numeric_values_and_invalid_receipts_are_rejected() {
    let mut document = BookmarkDocument::default();
    document.revision = MAX_SAFE_INTEGER + 1;
    assert_eq!(document.validate().unwrap_err().code, "invalid");
    document.revision = 0;
    document.migration = Some(MigrationReceipt {
        source_sha256: "forged".into(),
    });
    assert_eq!(document.validate().unwrap_err().code, "invalid");
}

#[test]
fn lexical_target_identity_matches_frontend_windows_and_posix_rules() {
    let identity = |path: &str| BookmarkTarget::LocalFile { path: path.into() }.identity();
    assert_eq!(identity(r"C:\Notes\\FILE.md\"), "c:/notes/file.md");
    assert_eq!(identity("C:/Notes/FILE.md/"), "c:/notes/file.md");
    assert_eq!(identity(r"\\SERVER\Share\FILE.md"), "/server/share/file.md");
    assert_eq!(identity("/Notes//FILE.md/"), "/Notes/FILE.md");
    assert_ne!(identity("/Notes/FILE.md"), identity("/notes/file.md"));
    assert_eq!(identity("/Notes/./file.md"), "/Notes/./file.md");
    assert_eq!(identity(r"/Notes\file.md"), r"/Notes\file.md");
    assert_eq!(identity("/"), "/");
}

#[test]
fn empty_tags_are_rejected_without_silently_dropping_them() {
    let directory = tempfile::tempdir().unwrap();
    let result = mutate_document(
        directory.path(),
        0,
        BookmarkMutation::Create {
            input: BookmarkInput {
                title: "Title".into(),
                target: target(directory.path(), "file.md"),
                tags: vec!["valid".into(), " ".into()],
            },
        },
        100,
    );
    assert_eq!(result.unwrap_err().code, "invalid");
    assert!(!directory.path().join(LIBRARY_FILE).exists());
}

#[cfg(unix)]
#[test]
fn symlink_sources_and_destinations_are_not_read_or_deleted() {
    use std::os::unix::fs::symlink;
    let directory = tempfile::tempdir().unwrap();
    let source = directory.path().join("actual.json");
    let bytes = legacy_bytes(directory.path());
    fs::write(&source, &bytes).unwrap();
    symlink(&source, directory.path().join(LEGACY_FILE)).unwrap();
    assert_eq!(
        load_document(directory.path(), 100).err().unwrap().code,
        "readFailed"
    );
    assert_eq!(fs::read(&source).unwrap(), bytes);
    fs::remove_file(directory.path().join(LEGACY_FILE)).unwrap();
    fs::write(directory.path().join(LEGACY_FILE), &bytes).unwrap();
    symlink(&source, directory.path().join(LIBRARY_FILE)).unwrap();
    assert_eq!(
        load_document(directory.path(), 100).err().unwrap().code,
        "readFailed"
    );
    assert_eq!(fs::read(&source).unwrap(), bytes);
    assert!(directory.path().join(LEGACY_FILE).exists());
}
