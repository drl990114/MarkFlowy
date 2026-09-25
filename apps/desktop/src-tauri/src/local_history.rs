//! The database has a single owner thread and a bounded mailbox, shared by all windows.
use mf_local_history::{Document, Draft, Store};
use serde_json::{json, Value};
use std::{
    path::Path,
    sync::{mpsc, Mutex, OnceLock},
    time::Duration,
};
use tauri::{Emitter, Manager};

type Job = Box<dyn FnOnce(&mut Store) + Send>;
static WORKER: Mutex<Option<mpsc::SyncSender<Job>>> = Mutex::new(None);
static APP: OnceLock<tauri::AppHandle> = OnceLock::new();

pub fn configure(app: &tauri::AppHandle) {
    let _ = APP.set(app.clone());
}

pub fn init(app: &tauri::AppHandle) -> Result<(), String> {
    let mut worker = WORKER
        .lock()
        .map_err(|_| "History worker lock unavailable")?;
    if worker.is_some() {
        return Ok(());
    }
    // Cache only a successfully started worker so a transient disk failure can be retried.
    let sender = (|| -> Result<mpsc::SyncSender<Job>, String> {
        let root = app
            .path()
            .app_local_data_dir()
            .map_err(|e| e.to_string())?
            .join("local-history");
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let enabled = serde_json::to_value(crate::app::conf::AppConf::read_with_app(app))
            .map_err(|e| e.to_string())?["local_history_enabled"]
            .as_bool()
            .unwrap_or(true);
        let (sender, receiver) = mpsc::sync_channel::<Job>(64);
        let (ready, started) = mpsc::sync_channel(1);
        std::thread::Builder::new()
            .name("markflowy-history".into())
            .spawn(move || {
                let mut store = match Store::open(&root.join("history.sqlite3")) {
                    Ok(s) => s.with_decoder(|bytes| {
                        crate::fc::decode_text_bytes(bytes).map_err(|e| anyhow::anyhow!(e.content))
                    }),
                    Err(e) => {
                        let _ = ready.send(Err(e.to_string()));
                        return;
                    }
                };
                if store.enabled().ok() != Some(enabled) {
                    if let Err(e) = store.set_enabled(enabled) {
                        let _ = ready.send(Err(e.to_string()));
                        return;
                    }
                }
                // Complete only writes whose exact target is already on disk. Never replay writes.
                if let Ok(writes) = store.pending_writes() {
                    for write in writes {
                        let operation = write["id"].as_str().unwrap_or_default();
                        let matches = write["path"]
                            .as_str()
                            .and_then(|p| std::fs::read(p).ok())
                            .is_some_and(|bytes| {
                                write["afterHash"] == mf_local_history::digest(&bytes)
                            });
                        if matches {
                            let _ = store.complete_write(operation, "recovered-save");
                        } else {
                            let _ = store.recover_write(operation);
                        }
                    }
                }
                let _ = store.reset_presence();
                let _ = ready.send(Ok(()));
                let mut last_gc = std::time::Instant::now();
                loop {
                    match receiver.recv_timeout(Duration::from_secs(60)) {
                        Ok(job) => {
                            job(&mut store);
                            if last_gc.elapsed() > Duration::from_secs(60) {
                                let _ = store.gc();
                                last_gc = std::time::Instant::now();
                            }
                        }
                        Err(mpsc::RecvTimeoutError::Timeout) => {
                            let _ = store.gc();
                        }
                        Err(_) => break,
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        started.recv().map_err(|e| e.to_string())??;
        Ok(sender)
    })()?;
    *worker = Some(sender);
    Ok(())
}

pub fn run<T: Send + 'static>(
    job: impl FnOnce(&mut Store) -> anyhow::Result<T> + Send + 'static,
) -> Result<T, String> {
    let worker = WORKER
        .lock()
        .map_err(|_| "History worker lock unavailable")?
        .as_ref()
        .cloned()
        .ok_or("History store is not initialized")?;
    let (send, receive) = mpsc::sync_channel(1);
    worker
        .send(Box::new(move |store| {
            let _ = send.send(job(store).map_err(|e| e.to_string()));
        }))
        .map_err(|e| e.to_string())?;
    receive.recv().map_err(|e| e.to_string())?
}

fn string<'a>(value: &'a Value, key: &str) -> anyhow::Result<&'a str> {
    value[key]
        .as_str()
        .ok_or_else(|| anyhow::anyhow!("Missing {key}"))
}
fn document(value: &Value) -> anyhow::Result<Document> {
    Ok(serde_json::from_value(value["document"].clone())?)
}

#[tauri::command]
pub async fn local_history(
    app: tauri::AppHandle,
    operation: String,
    payload: Value,
) -> Result<Value, String> {
    let handle = app.clone();
    let change = json!({ "operation": operation, "workspace": payload["workspace"] });
    let notify = matches!(
        operation.as_str(),
        "clear" | "enabled" | "begin" | "commit" | "checkpoint" | "boundary" | "rebase" | "restore"
    );
    let result = tauri::async_runtime::spawn_blocking(move || {
        init(&handle)?;
        // Same lock order as writes: filesystem mutation, then history worker.
        let _guard = if matches!(operation.as_str(), "clear" | "enabled") {
            Some(
                crate::fc::FILE_WRITE_MUTEX
                    .lock()
                    .map_err(|_| "File write lock unavailable")?,
            )
        } else {
            None
        };
        run(move |store| {
            if matches!(
                operation.as_str(),
                "recoveryDraftIndex" | "claimRecoveryDraft" | "recoveryDrafts"
            ) {
                let owners = handle
                    .webview_windows()
                    .keys()
                    .map(|label| format!("{label}:"))
                    .collect::<Vec<_>>();
                store.retain_window_presence(&owners)?;
            }
            dispatch(store, &operation, payload)
        })
    })
    .await
    .map_err(|e| e.to_string())??;
    if notify {
        let _ = app.emit("local-history-changed", change);
    }
    Ok(result)
}

fn dispatch(store: &mut Store, operation: &str, p: Value) -> anyhow::Result<Value> {
    Ok(match operation {
        "rebase" => {
            store.rebase(string(&p, "oldPath")?, string(&p, "newPath")?)?;
            json!(true)
        }
        "register" => serde_json::to_value(store.register(
            string(&p, "identity")?,
            string(&p, "workspace")?,
            p["path"].as_str(),
            string(&p, "name")?,
        )?)?,
        "observe" => {
            store.observe_with_format(
                &document(&p)?,
                string(&p, "content")?,
                serde_json::from_value(p["format"].clone())?,
            )?;
            json!(true)
        }
        "presence" => {
            store.presence(
                string(&p, "documentId")?,
                string(&p, "owner")?,
                p["dirty"].as_bool().unwrap_or(false),
            )?;
            json!(true)
        }
        "restore" => serde_json::to_value(store.restore(
            string(&p, "entryId")?,
            p["before"].as_bool().unwrap_or(false),
            serde_json::from_value(p["draft"].clone())?,
            string(&p, "previous")?,
        )?)?,
        "receipt" => store
            .receipt(string(&p, "operationId")?, string(&p, "fingerprint")?)?
            .unwrap_or(Value::Null),
        "recordReceipt" => store.record_receipt(
            string(&p, "operationId")?,
            string(&p, "fingerprint")?,
            &p["result"],
        )?,
        "document" => serde_json::to_value(store.document(string(&p, "id")?)?)?,
        "draft" => json!({"persisted":store.put_draft(&serde_json::from_value::<Draft>(p)?)?}),
        "finishDraft" => {
            store.finish_draft(
                string(&p, "documentId")?,
                string(&p, "writer")?,
                p["sequence"].as_i64().unwrap_or(0),
            )?;
            json!(true)
        }
        "drafts" => serde_json::to_value(store.drafts(string(&p, "workspace")?)?)?,
        "recoveryDraftIndex" => serde_json::to_value(
            store.recovery_draft_index(string(&p, "workspace")?, string(&p, "ownerPrefix")?)?,
        )?,
        "draftDescriptor" => {
            serde_json::to_value(store.draft_descriptor(&document(&p)?, string(&p, "writer")?)?)?
        }
        "claimRecoveryDraft" => serde_json::to_value(store.claim_recovery_draft(
            &serde_json::from_value(p["draft"].clone())?,
            string(&p, "ownerPrefix")?,
            string(&p, "claimId")?,
        )?)?,
        "recoveryDrafts" => serde_json::to_value(
            store.claim_recovery_drafts(string(&p, "workspace")?, string(&p, "ownerPrefix")?)?,
        )?,
        "boundary" => {
            store.boundary(&document(&p)?)?;
            json!(true)
        }
        "external" => {
            let doc = document(&p)?;
            if let Some(path) = &doc.path {
                verify_current_text(path, string(&p, "after")?)?;
            }
            json!({"versionId":store.external_with_formats(&doc,string(&p,"before")?,string(&p,"after")?,serde_json::from_value(p["beforeFormat"].clone())?,serde_json::from_value(p["afterFormat"].clone())?)?})
        }
        "checkpoint" => {
            json!({"versionId":store.checkpoint_with_format(&document(&p)?,p["before"].as_str().map(str::as_bytes),string(&p,"content")?.as_bytes(),string(&p,"kind")?,p["message"].as_str().unwrap_or(""),serde_json::from_value(p["format"].clone())?)?})
        }
        "begin" => {
            let doc = document(&p)?;
            if let Some(path) = &doc.path {
                if let Some(content) = p["content"].as_str() {
                    verify_current_text(path, content)?;
                } else {
                    match std::fs::symlink_metadata(path) {
                        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                        Err(_) => anyhow::bail!("file_unavailable"),
                        Ok(_) => anyhow::bail!("content_changed"),
                    }
                }
            }
            store.begin(&doc, string(&p, "requestId")?, p["content"].as_str())?
        }
        "session" => store.session(string(&p, "sessionId")?)?,
        "commit" => {
            let session = store.session(string(&p, "sessionId")?)?;
            if session["state"] == "active" {
                let doc = store.document(string(&session, "documentId")?)?;
                verify_current_text(
                    doc.path
                        .as_deref()
                        .ok_or_else(|| anyhow::anyhow!("file_unavailable"))?,
                    string(&p, "content")?,
                )?;
            }
            store.commit(
                string(&p, "sessionId")?,
                string(&p, "content")?,
                string(&p, "sha256")?,
                p["message"].as_str().unwrap_or(""),
            )?
        }
        "list" => serde_json::to_value(store.list(
            p["workspace"].as_str(),
            p["documentId"].as_str(),
            p["offset"].as_i64().unwrap_or(0),
        )?)?,
        "exists" => json!(store.entry_exists(string(&p, "entryId")?)?),
        "read" => {
            let (doc, content, format) = store.read_text_snapshot(
                string(&p, "entryId")?,
                p["before"].as_bool().unwrap_or(false),
            )?;
            json!({"document":doc,"content":content,"format":format})
        }
        "stats" => store.stats(p["workspace"].as_str())?,
        "clear" => store.clear(p["workspace"].as_str())?,
        "enabled" => {
            store.set_enabled(
                p["enabled"]
                    .as_bool()
                    .ok_or_else(|| anyhow::anyhow!("Missing enabled"))?,
            )?;
            json!(true)
        }
        "pendingWrites" => json!(store.pending_writes()?),
        _ => anyhow::bail!("Unknown history operation"),
    })
}

fn verify_current_text(path: &str, content: &str) -> anyhow::Result<()> {
    match crate::fc::read_file_snapshot(Path::new(path)) {
        crate::fc::FileSnapshotResult::Success {
            content: current, ..
        } if current == content => Ok(()),
        crate::fc::FileSnapshotResult::Success { .. } => anyhow::bail!("content_changed"),
        _ => anyhow::bail!("file_unstable"),
    }
}

/// Called while the filesystem mutex is held, before any truncation.
pub fn prepare_write(path: &Path, content: &[u8]) -> Result<Option<String>, String> {
    prepare_write_with_formats(path, content, None)
}

pub fn prepare_write_with_formats(
    path: &Path,
    content: &[u8],
    formats: Option<(
        Option<mf_text_encoding::TextFileFormat>,
        mf_text_encoding::TextFileFormat,
    )>,
) -> Result<Option<String>, String> {
    if let Some(app) = APP.get() {
        init(app)?;
    } else {
        return Ok(None);
    } // Unit tests / non-GUI tooling have no history host.
    let path = path.to_string_lossy().into_owned();
    let before = match std::fs::read(&path) {
        Ok(b) => Some(b),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
        Err(e) => return Err(e.to_string()),
    };
    let content = content.to_vec();
    run(move |store| {
        let doc = if let Some(doc) = store.find_path(&path)? {
            doc
        } else {
            store.register(
                &path,
                "",
                Some(&path),
                Path::new(&path)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("document"),
            )?
        };
        Ok(Some(store.prepare_write_with_formats(
            &doc,
            before.as_deref(),
            &content,
            formats,
        )?))
    })
}

pub fn complete_write(operation: Option<String>, kind: &str) -> Result<(), String> {
    let kind = kind.to_string();
    if let Some(operation) = operation {
        run(move |s| {
            s.complete_write(&operation, &kind)?;
            Ok(())
        })?;
    }
    Ok(())
}

pub fn cancel_write(operation: Option<String>) -> Result<(), String> {
    if let Some(operation) = operation {
        run(move |s| s.cancel_write(&operation))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn recovery_protocol_transfers_metadata_then_one_claimed_body() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(&root.path().join("history.db")).unwrap();
        let document = dispatch(
            &mut store,
            "register",
            json!({
                "identity": "untitled:old", "workspace": "", "name": "Untitled.md"
            }),
        )
        .unwrap();
        dispatch(
            &mut store,
            "draft",
            json!({
                "document": document, "writer": "old:file", "sequence": 1,
                "content": "中文 draft", "diskRevision": null, "paused": true,
                "format": { "encoding": "gb18030", "bom": "none" }
            }),
        )
        .unwrap();
        let index = dispatch(
            &mut store,
            "recoveryDraftIndex",
            json!({
                "workspace": "", "ownerPrefix": "main:"
            }),
        )
        .unwrap();
        assert_eq!(index.as_array().unwrap().len(), 1);
        assert!(index[0].get("content").is_none());
        let claimed = dispatch(
            &mut store,
            "claimRecoveryDraft",
            json!({
                "draft": index[0], "ownerPrefix": "main:", "claimId": "first"
            }),
        )
        .unwrap();
        assert_eq!(claimed["content"], "中文 draft");
        assert_eq!(claimed["writer"], "main:first");
        let saved = dispatch(
            &mut store,
            "draftDescriptor",
            json!({
                "document": claimed["document"], "writer": claimed["writer"]
            }),
        )
        .unwrap();
        assert_eq!(saved["hash"], index[0]["hash"]);
        assert_eq!(saved["format"]["encoding"], "gb18030");
        assert_eq!(saved["diskRevision"], Value::Null);
        assert!(saved.get("content").is_none());
    }

    #[test]
    fn stale_external_content_is_rejected_before_history_mutation() {
        let root = tempfile::tempdir().unwrap();
        let path = root.path().join("document.md");
        std::fs::write(&path, b"newest").unwrap();
        assert!(verify_current_text(path.to_str().unwrap(), "older").is_err());
        assert!(verify_current_text(path.to_str().unwrap(), "newest").is_ok());
    }
    #[test]
    fn raw_utf16_backup_uses_the_editors_decoder_for_history_preview() {
        let root = tempfile::tempdir().unwrap();
        let mut store = Store::open(&root.path().join("history.db"))
            .unwrap()
            .with_decoder(|bytes| {
                crate::fc::decode_text_bytes(bytes).map_err(|e| anyhow::anyhow!(e.content))
            });
        let doc = store.register("/a.md", "", Some("/a.md"), "a.md").unwrap();
        let mut bytes = vec![0xff, 0xfe];
        for unit in "原文".encode_utf16() {
            bytes.extend(unit.to_le_bytes());
        }
        let operation = store
            .prepare_write(&doc, Some(&bytes), "修改后".as_bytes())
            .unwrap();
        assert_eq!(store.read_entry(&operation, true).unwrap().1, "原文");
        store.recover_write(&operation).unwrap();
        let drafts = store.drafts("").unwrap();
        assert!(drafts.iter().any(|d| d.content == "原文"));
        assert!(drafts.iter().any(|d| d.content == "修改后"));
    }
}
