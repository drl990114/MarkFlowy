// Exercise the actual dispatch on a separate owner thread while its caller owns
// the file lock. A timeout releases the caller's guard before joining the worker,
// so a regression reports a failure instead of hanging the test process.
fn dispatch_on_locked_worker(mut store: Store, operation: &str, payload: Value) -> (Store, Value) {
    std::thread::scope(|scope| {
        let (start, started) = mpsc::sync_channel(1);
        let (reply, result) = mpsc::sync_channel(1);
        let worker = scope.spawn(move || {
            started.recv().unwrap();
            let value = dispatch(&mut store, operation, payload).map_err(|e| e.to_string());
            let _ = reply.send(value);
            store
        });
        let value = with_operation_file_lock(operation, || {
            start.send(()).unwrap();
            result
                .recv_timeout(Duration::from_secs(2))
                .map_err(|e| e.to_string())?
        });
        let store = worker.join().unwrap();
        (
            store,
            value.expect("history must finish while its caller holds the file lock"),
        )
    })
}

#[test]
fn disk_history_operations_acquire_the_file_lock_before_entering_the_worker() {
    for operation in ["external", "begin", "commit", "clear", "enabled"] {
        std::thread::scope(|scope| {
            let guard = crate::fc::FILE_WRITE_MUTEX.lock().unwrap();
            let (ready, waiting) = mpsc::channel();
            let (send, receive) = mpsc::channel();
            let caller = scope.spawn(move || {
                ready.send(()).unwrap();
                with_operation_file_lock(operation, || {
                    send.send(()).unwrap();
                    Ok(())
                })
                .unwrap();
            });
            waiting.recv().unwrap();
            let before_unlock = receive.recv_timeout(Duration::from_millis(20));
            drop(guard);
            caller.join().unwrap();
            assert!(
                matches!(before_unlock, Err(mpsc::RecvTimeoutError::Timeout)),
                "{operation}"
            );
            receive.recv_timeout(Duration::from_secs(2)).unwrap();
        });
    }
}

#[test]
fn external_and_cli_verification_complete_under_the_callers_file_lock() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("document.md");
    std::fs::write(&path, b"after").unwrap();
    let mut store = Store::open(&root.path().join("history.db")).unwrap();
    let doc = write_document(&mut store, path.to_str().unwrap(), "").unwrap();
    let (store, _) = dispatch_on_locked_worker(
        store,
        "external",
        json!({
            "document": doc, "before": "before", "after": "after"
        }),
    );
    let (store, session) = dispatch_on_locked_worker(
        store,
        "begin",
        json!({
            "document": doc, "content": "after", "requestId": "request"
        }),
    );
    std::fs::write(&path, b"committed").unwrap();
    let (_, result) = dispatch_on_locked_worker(
        store,
        "commit",
        json!({
            "sessionId": session["sessionId"], "content": "committed",
            "sha256": mf_local_history::digest(b"committed"), "message": "test"
        }),
    );
    assert_eq!(result["code"], "history_committed");
}

#[test]
fn external_history_verifies_ambiguous_bytes_with_the_selected_encoding() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("gbk.md");
    std::fs::write(&path, [0xc2, 0xa9, b'!']).unwrap();
    let mut store = Store::open(&root.path().join("history.db")).unwrap();
    let doc = write_document(&mut store, path.to_str().unwrap(), "").unwrap();
    let format = json!({ "encoding": "gbk", "bom": "none" });
    let (store, result) = dispatch_on_locked_worker(
        store,
        "external",
        json!({
            "document": doc, "before": "漏", "after": "漏!",
            "beforeFormat": format, "afterFormat": format
        }),
    );
    let (_, content, format) = store
        .read_text_snapshot(result["versionId"].as_str().unwrap(), false)
        .unwrap();
    assert_eq!(content, "漏!");
    assert_eq!(
        format.unwrap().encoding,
        mf_text_encoding::TextEncoding::Gbk
    );
}

#[test]
fn first_save_registers_workspace_before_history_and_is_cleared_with_it() {
    let root = tempfile::tempdir().unwrap();
    let workspace = root.path().to_str().unwrap();
    let path = root.path().join("new.md");
    let path = path.to_str().unwrap();
    let mut store = Store::open(&root.path().join("history.db")).unwrap();
    let native = write_document(&mut store, path, workspace).unwrap();
    let write = store.prepare_write(&native, None, b"saved").unwrap();
    store.complete_write(&write, "save").unwrap();
    let registered = store
        .register(path, workspace, Some(path), "new.md")
        .unwrap();
    assert_eq!(registered.workspace, workspace);
    assert_eq!(store.list(Some(workspace), None, 0).unwrap().len(), 1);
    assert!(store.list(Some(""), None, 0).unwrap().is_empty());
    store.clear(Some(workspace)).unwrap();
    assert!(store
        .list(None, Some(&registered.id), 0)
        .unwrap()
        .is_empty());
}

#[test]
fn writes_keep_existing_ownership_and_support_independent_files() {
    let root = tempfile::tempdir().unwrap();
    let mut store = Store::open(&root.path().join("history.db")).unwrap();
    let doc = write_document(&mut store, "/workspace/note.md", "/workspace").unwrap();
    let other_window = write_document(&mut store, "/workspace/note.md", "").unwrap();
    assert_eq!(other_window.id, doc.id);
    assert_eq!(other_window.workspace, "/workspace");
    assert_eq!(
        write_document(&mut store, "/loose.md", "")
            .unwrap()
            .workspace,
        ""
    );
}
