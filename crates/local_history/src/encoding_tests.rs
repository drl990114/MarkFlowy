use super::*;
use mf_text_encoding::{encode, Bom, TextEncoding};

fn setup() -> (tempfile::TempDir, Store, Document) {
    let dir = tempfile::tempdir().unwrap();
    let mut store = Store::open(&dir.path().join("history.db")).unwrap();
    let doc = store
        .register("/w/a.md", "/w", Some("/w/a.md"), "a.md")
        .unwrap();
    (dir, store, doc)
}
fn gbk() -> TextFileFormat {
    TextFileFormat {
        encoding: TextEncoding::Gbk,
        bom: Bom::None,
    }
}

#[test]
fn interrupted_gbk_write_recovers_both_sides_as_unicode_with_formats() {
    let (_dir, mut store, doc) = setup();
    let before = encode("原文\r\n", gbk()).unwrap();
    let after_format = TextFileFormat {
        encoding: TextEncoding::Utf16be,
        bom: Bom::Utf16be,
    };
    let after = encode("修改😀\r\n", after_format).unwrap();
    let operation = store
        .prepare_write_with_formats(
            &doc,
            Some(&before),
            &after,
            Some((Some(gbk()), after_format)),
        )
        .unwrap();
    store.recover_write(&operation).unwrap();
    let drafts = store.drafts("/w").unwrap();
    assert!(drafts
        .iter()
        .any(|d| d.content == "原文\r\n" && d.format == Some(gbk())));
    assert!(drafts
        .iter()
        .any(|d| d.content == "修改😀\r\n" && d.format == Some(after_format)));
}

#[test]
fn conversion_history_keeps_independent_before_and_after_formats() {
    let (_dir, mut store, doc) = setup();
    let before = encode("原文", gbk()).unwrap();
    let after_format = TextFileFormat::default();
    let after = encode("修改😀", after_format).unwrap();
    let operation = store
        .prepare_write_with_formats(
            &doc,
            Some(&before),
            &after,
            Some((Some(gbk()), after_format)),
        )
        .unwrap();
    let entry = store.complete_write(&operation, "save").unwrap().unwrap();
    let before = store.read_text_snapshot(&entry, true).unwrap();
    let after = store.read_text_snapshot(&entry, false).unwrap();
    assert_eq!((before.1.as_str(), before.2), ("原文", Some(gbk())));
    assert_eq!((after.1.as_str(), after.2), ("修改😀", Some(after_format)));
    store
        .observe_with_format(&doc, "修改😀", Some(after_format))
        .unwrap();
}

#[test]
fn unencodable_draft_and_leading_feff_survive_recovery_and_restore() {
    let (_dir, mut store, doc) = setup();
    let content = "\u{feff}😀\r\n\r";
    let draft = Draft {
        document: doc.clone(),
        writer: "writer".into(),
        sequence: 1,
        content: content.into(),
        disk_revision: None,
        paused: true,
        format: Some(gbk()),
    };
    store.put_draft(&draft).unwrap();
    assert_eq!(store.drafts("/w").unwrap()[0].content, content);
    let claimed = store.claim_recovery_drafts("/w", "main:").unwrap();
    assert_eq!(claimed[0].format, Some(gbk()));
    let entry = store
        .checkpoint_with_format(
            &doc,
            None,
            content.as_bytes(),
            "checkpoint",
            "",
            Some(gbk()),
        )
        .unwrap()
        .unwrap();
    let restored = store.restore(&entry, false, draft, "previous").unwrap();
    assert_eq!(restored.content, content);
    assert_eq!(restored.format, Some(gbk()));
}

#[test]
fn identical_unicode_objects_can_have_different_target_formats() {
    let (_dir, mut store, doc) = setup();
    let first = store
        .checkpoint_with_format(&doc, None, b"ASCII", "save", "", Some(gbk()))
        .unwrap()
        .unwrap();
    let second = store
        .checkpoint_with_format(
            &doc,
            None,
            b"ASCII",
            "save",
            "",
            Some(TextFileFormat::default()),
        )
        .unwrap()
        .unwrap();
    assert_ne!(first, second);
    assert_eq!(
        store.read_text_snapshot(&first, false).unwrap().2,
        Some(gbk())
    );
    assert_eq!(
        store.read_text_snapshot(&second, false).unwrap().2,
        Some(TextFileFormat::default())
    );
}

#[test]
fn schema_one_records_migrate_without_guessing_a_writable_format() {
    let (dir, mut store, doc) = setup();
    let entry = store
        .checkpoint(&doc, None, b"legacy", "save", "")
        .unwrap()
        .unwrap();
    store
        .conn
        .execute_batch("DROP TABLE text_snapshots; PRAGMA user_version=1;")
        .unwrap();
    drop(store);
    let store = Store::open(&dir.path().join("history.db")).unwrap();
    let snapshot = store.read_text_snapshot(&entry, false).unwrap();
    assert_eq!(snapshot.1, "legacy");
    assert_eq!(snapshot.2, None);
}
