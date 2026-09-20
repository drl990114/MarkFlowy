//! Transactional local history. All access is serialized by the host's bounded worker.
use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

const DAY: i64 = 86_400_000;
const BUDGET: i64 = 1024 * 1024 * 1024;

pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}

fn path_identity(path: &str) -> String {
    let windows = path.starts_with("\\\\") || path.as_bytes().get(1) == Some(&b':');
    let mut key = if windows {
        path.replace('\\', "/").to_lowercase()
    } else {
        path.to_string()
    };
    while key.contains("//") {
        key = key.replace("//", "/");
    }
    if key.len() > 1 {
        key = key.trim_end_matches('/').to_string();
    }
    key
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub workspace: String,
    pub path: Option<String>,
    pub name: String,
    pub generation: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Draft {
    pub document: Document,
    pub writer: String,
    pub sequence: i64,
    pub content: String,
    pub disk_revision: Option<String>,
    pub paused: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Entry {
    pub id: String,
    pub document_id: String,
    pub name: String,
    pub path: Option<String>,
    pub kind: String,
    pub message: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub active: bool,
    pub before_hash: Option<String>,
    pub after_hash: String,
}

pub struct Store {
    conn: Connection,
    decode: fn(Vec<u8>) -> Result<String>,
}

impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
        if version > 1 {
            bail!("unsupported_history_schema");
        }
        if version == 0 {
            conn.execute_batch("PRAGMA auto_vacuum=INCREMENTAL;")?;
        }
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
            CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, value INTEGER NOT NULL);
            INSERT OR IGNORE INTO config VALUES('enabled',1);
            CREATE TABLE IF NOT EXISTS scopes(id TEXT PRIMARY KEY, generation INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, workspace TEXT NOT NULL REFERENCES scopes(id), identity TEXT NOT NULL UNIQUE, path TEXT, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS objects(hash TEXT PRIMARY KEY, body BLOB NOT NULL);
            CREATE TABLE IF NOT EXISTS entries(id TEXT PRIMARY KEY, document TEXT NOT NULL REFERENCES documents(id), kind TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, updated INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 0, before_hash TEXT REFERENCES objects(hash), after_hash TEXT NOT NULL REFERENCES objects(hash));
            CREATE INDEX IF NOT EXISTS entry_document ON entries(document, updated DESC);
            CREATE UNIQUE INDEX IF NOT EXISTS active_entry ON entries(document) WHERE active=1;
            CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, request TEXT UNIQUE NOT NULL, document TEXT NOT NULL REFERENCES documents(id), generation INTEGER NOT NULL, entry TEXT, state TEXT NOT NULL, result TEXT);
            CREATE TABLE IF NOT EXISTS drafts(document TEXT NOT NULL REFERENCES documents(id), writer TEXT NOT NULL, sequence INTEGER NOT NULL, hash TEXT REFERENCES objects(hash), disk_revision TEXT, paused INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, PRIMARY KEY(document,writer));
            CREATE TABLE IF NOT EXISTS writes(id TEXT PRIMARY KEY, document TEXT NOT NULL REFERENCES documents(id), before_hash TEXT REFERENCES objects(hash), after_hash TEXT NOT NULL REFERENCES objects(hash), state TEXT NOT NULL, created INTEGER NOT NULL);
            CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, result TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS baselines(document TEXT PRIMARY KEY REFERENCES documents(id), hash TEXT NOT NULL REFERENCES objects(hash));
            CREATE TABLE IF NOT EXISTS presence(document TEXT NOT NULL REFERENCES documents(id), owner TEXT NOT NULL, dirty INTEGER NOT NULL, PRIMARY KEY(document,owner));
            INSERT OR IGNORE INTO config SELECT 'bytes',COALESCE(SUM(length(body)),0) FROM objects;
            CREATE TRIGGER IF NOT EXISTS object_added AFTER INSERT ON objects BEGIN UPDATE config SET value=value+length(NEW.body) WHERE key='bytes'; END;
            CREATE TRIGGER IF NOT EXISTS object_removed AFTER DELETE ON objects BEGIN UPDATE config SET value=value-length(OLD.body) WHERE key='bytes'; END;
            PRAGMA user_version=1;")?;
        Ok(Self {
            conn,
            decode: |bytes| Ok(String::from_utf8(bytes)?),
        })
    }

    /// The host supplies the same decoder used when opening files, including UTF-16.
    pub fn with_decoder(mut self, decode: fn(Vec<u8>) -> Result<String>) -> Self {
        self.decode = decode;
        self
    }

    fn used_bytes(&self) -> Result<i64> {
        Ok(self
            .conn
            .query_row("SELECT value FROM config WHERE key='bytes'", [], |r| {
                r.get(0)
            })?)
    }

    pub fn enabled(&self) -> Result<bool> {
        Ok(self
            .conn
            .query_row("SELECT value FROM config WHERE key='enabled'", [], |r| {
                r.get(0)
            })?)
    }

    pub fn set_enabled(&mut self, enabled: bool) -> Result<()> {
        if self.enabled()? == enabled {
            return Ok(());
        }
        let tx = self.conn.transaction()?;
        tx.execute("UPDATE config SET value=? WHERE key='enabled'", [enabled])?;
        tx.execute("UPDATE scopes SET generation=generation+1", [])?;
        tx.execute("UPDATE entries SET active=0 WHERE active=1", [])?;
        tx.execute("DELETE FROM baselines", [])?;
        tx.execute(
            "UPDATE sessions SET state='interrupted' WHERE state='active'",
            [],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn register(
        &mut self,
        identity: &str,
        workspace: &str,
        path: Option<&str>,
        name: &str,
    ) -> Result<Document> {
        let identity = path
            .map(path_identity)
            .unwrap_or_else(|| identity.to_string());
        let tx = self.conn.transaction()?;
        tx.execute("INSERT OR IGNORE INTO scopes(id) VALUES(?)", [workspace])?;
        tx.execute("INSERT INTO documents(id,workspace,identity,path,name) VALUES(?,?,?,?,?) ON CONFLICT(identity) DO UPDATE SET name=excluded.name,path=excluded.path", params![id(), workspace, identity, path, name])?;
        let doc = tx.query_row("SELECT d.id,d.workspace,d.path,d.name,s.generation FROM documents d JOIN scopes s ON s.id=d.workspace WHERE identity=?", [&identity], document_row)?;
        tx.commit()?;
        Ok(doc)
    }

    pub fn document(&self, doc: &str) -> Result<Document> {
        Ok(self.conn.query_row("SELECT d.id,d.workspace,d.path,d.name,s.generation FROM documents d JOIN scopes s ON s.id=d.workspace WHERE d.id=?", [doc], document_row)?)
    }

    pub fn observe(&mut self, doc: &Document, content: &str) -> Result<()> {
        self.check(doc)?;
        let old: Option<Vec<u8>> = self.conn.query_row("SELECT body FROM baselines JOIN objects ON baselines.hash=objects.hash WHERE document=?", [&doc.id], |r| r.get(0)).optional()?;
        if let Some(old) = old {
            let old = (self.decode)(old)?;
            self.external(doc, &old, content)?;
        } else if doc.generation == 0 {
            self.checkpoint(doc, None, content.as_bytes(), "opened", "")?;
        }
        let tx = self.conn.transaction()?;
        let hash = put_object(&tx, content.as_bytes())?;
        tx.execute("INSERT INTO baselines VALUES(?,?) ON CONFLICT(document) DO UPDATE SET hash=excluded.hash",params![doc.id,hash])?;
        tx.commit()?;
        Ok(())
    }

    pub fn presence(&mut self, doc: &str, owner: &str, dirty: bool) -> Result<()> {
        self.conn.execute("INSERT INTO presence VALUES(?,?,?) ON CONFLICT(document,owner) DO UPDATE SET dirty=excluded.dirty",params![doc,owner,dirty])?;
        Ok(())
    }

    pub fn reset_presence(&mut self) -> Result<()> {
        self.conn.execute("DELETE FROM presence", [])?;
        Ok(())
    }

    pub fn rebase(&mut self, old: &str, new: &str) -> Result<()> {
        let rows = {
            let mut stmt = self
                .conn
                .prepare("SELECT id,path FROM documents WHERE path IS NOT NULL")?;
            let rows = stmt
                .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        };
        let scopes = {
            let mut stmt = self.conn.prepare("SELECT id,generation FROM scopes")?;
            let rows = stmt
                .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rows
        };
        let tx = self.conn.transaction()?;
        for (workspace, generation) in scopes {
            if workspace.is_empty() {
                continue;
            }
            if let Ok(relative) = Path::new(&workspace).strip_prefix(path_identity(old)) {
                let next = path_identity(&Path::new(new).join(relative).to_string_lossy());
                tx.execute("INSERT INTO scopes VALUES(?,?) ON CONFLICT(id) DO UPDATE SET generation=MAX(scopes.generation,excluded.generation)+1",params![next,generation+1])?;
                tx.execute(
                    "UPDATE documents SET workspace=? WHERE workspace=?",
                    params![next, workspace],
                )?;
                tx.execute("UPDATE sessions SET state='interrupted' WHERE document IN (SELECT id FROM documents WHERE workspace=?) AND state='active'",[&next])?;
            }
        }
        for (doc, path) in rows {
            let Ok(relative) = Path::new(&path).strip_prefix(old) else {
                continue;
            };
            let next = Path::new(new).join(relative).to_string_lossy().into_owned();
            let identity = path_identity(&next);
            tx.execute("UPDATE documents SET identity='archived:'||id,path=NULL WHERE identity=? AND id<>?",params![identity,doc])?;
            tx.execute(
                "UPDATE documents SET path=?,identity=?,name=? WHERE id=?",
                params![
                    next,
                    identity,
                    Path::new(&next)
                        .file_name()
                        .and_then(|s| s.to_str())
                        .unwrap_or("document"),
                    doc
                ],
            )?;
            tx.execute("UPDATE entries SET active=0 WHERE document=?", [&doc])?;
            tx.execute(
                "UPDATE sessions SET state='interrupted' WHERE document=? AND state='active'",
                [&doc],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn restore(
        &mut self,
        entry: &str,
        before: bool,
        mut draft: Draft,
        previous: &str,
    ) -> Result<Draft> {
        let (_, content) = self.read_entry(entry, before)?;
        self.check(&draft.document)?;
        draft.content = content;
        draft.paused = true;
        let enabled = self.enabled()?;
        let tx = self.conn.transaction()?;
        let previous_hash = put_object(&tx, previous.as_bytes())?;
        let hash = put_object(&tx, draft.content.as_bytes())?;
        if enabled {
            insert_entry(
                &tx,
                &draft.document.id,
                "restore",
                "",
                None,
                &previous_hash,
                false,
            )?;
        }
        // Even with history disabled, the displaced draft remains recoverable.
        if !enabled {
            tx.execute(
                "INSERT OR REPLACE INTO drafts VALUES(?,?,?,?,?,?,?)",
                params![
                    draft.document.id,
                    format!("before-restore:{}:{}", draft.writer, draft.sequence),
                    draft.sequence,
                    previous_hash,
                    draft.disk_revision,
                    true,
                    now()
                ],
            )?;
        }
        tx.execute(
            "INSERT OR REPLACE INTO drafts VALUES(?,?,?,?,?,?,?)",
            params![
                draft.document.id,
                draft.writer,
                draft.sequence,
                hash,
                draft.disk_revision,
                true,
                now()
            ],
        )?;
        tx.execute(
            "UPDATE entries SET active=0 WHERE document=?",
            [&draft.document.id],
        )?;
        tx.execute(
            "UPDATE sessions SET state='interrupted' WHERE document=? AND state='active'",
            [&draft.document.id],
        )?;
        tx.commit()?;
        Ok(draft)
    }

    pub fn receipt(&self, operation: &str, fingerprint: &str) -> Result<Option<Value>> {
        let row: Option<(String, String)> = self
            .conn
            .query_row(
                "SELECT fingerprint,result FROM receipts WHERE id=?",
                [operation],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .optional()?;
        match row {
            Some((old, result)) => {
                if old != fingerprint {
                    bail!("request_conflict");
                }
                let value: Value = serde_json::from_str(&result)?;
                if value["invalidated"] == true {
                    bail!("history_invalidated");
                }
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    pub fn record_receipt(
        &mut self,
        operation: &str,
        fingerprint: &str,
        result: &Value,
    ) -> Result<Value> {
        if let Some(previous) = self.receipt(operation, fingerprint)? {
            return Ok(previous);
        }
        if let Some(version) = result["result"]["versionId"].as_str() {
            if !self.entry_exists(version)? {
                bail!("history_invalidated");
            }
        }
        self.conn.execute(
            "INSERT INTO receipts VALUES(?,?,?)",
            params![operation, fingerprint, result.to_string()],
        )?;
        Ok(result.clone())
    }

    pub fn find_path(&self, path: &str) -> Result<Option<Document>> {
        Ok(self.conn.query_row("SELECT d.id,d.workspace,d.path,d.name,s.generation FROM documents d JOIN scopes s ON s.id=d.workspace WHERE d.identity=? LIMIT 1", [path_identity(path)], document_row).optional()?)
    }

    fn check(&self, doc: &Document) -> Result<()> {
        let current = self.document(&doc.id)?;
        if current.generation != doc.generation
            || current.workspace != doc.workspace
            || current.path.as_deref().map(path_identity) != doc.path.as_deref().map(path_identity)
        {
            bail!("history_invalidated");
        }
        Ok(())
    }

    pub fn put_draft(&mut self, draft: &Draft) -> Result<bool> {
        // History deletion must not prevent the latest unsaved text from being protected.
        let tx = self.conn.transaction()?;
        let hash = put_object(&tx, draft.content.as_bytes())?;
        let changed = tx.execute("INSERT INTO drafts VALUES(?,?,?,?,?,?,?) ON CONFLICT(document,writer) DO UPDATE SET sequence=excluded.sequence,hash=excluded.hash,disk_revision=excluded.disk_revision,paused=excluded.paused,updated=excluded.updated WHERE excluded.sequence>drafts.sequence", params![draft.document.id, draft.writer, draft.sequence, hash, draft.disk_revision, draft.paused, now()])?;
        tx.commit()?;
        Ok(changed != 0)
    }

    pub fn finish_draft(&mut self, doc: &str, writer: &str, sequence: i64) -> Result<()> {
        // Keep a tombstone so an older in-flight submission cannot resurrect a saved draft.
        self.conn.execute("INSERT INTO drafts VALUES(?,?,?,NULL,NULL,0,?) ON CONFLICT(document,writer) DO UPDATE SET sequence=excluded.sequence,hash=NULL,paused=0,updated=excluded.updated WHERE excluded.sequence>=drafts.sequence", params![doc, writer, sequence, now()])?;
        Ok(())
    }

    pub fn drafts(&self, workspace: &str) -> Result<Vec<Draft>> {
        let mut statement = self.conn.prepare("SELECT document,writer,sequence,body,disk_revision,paused,objects.hash FROM drafts JOIN objects ON drafts.hash=objects.hash JOIN documents ON document=documents.id WHERE workspace=? ORDER BY updated")?;
        let rows = statement.query_map([workspace], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, i64>(2)?,
                r.get::<_, Vec<u8>>(3)?,
                r.get::<_, Option<String>>(4)?,
                r.get::<_, bool>(5)?,
                r.get::<_, String>(6)?,
            ))
        })?;
        rows.map(|row| {
            let (doc, writer, sequence, bytes, disk_revision, paused, hash) = row?;
            if digest(&bytes) != hash {
                bail!("history_corrupt");
            }
            Ok(Draft {
                document: self.document(&doc)?,
                writer,
                sequence,
                content: String::from_utf8(bytes)?,
                disk_revision,
                paused,
            })
        })
        .collect()
    }

    pub fn recovery_drafts(&self, workspace: &str, owner_prefix: &str) -> Result<Vec<Draft>> {
        let drafts = self.drafts(workspace)?;
        let mut result = Vec::new();
        for draft in drafts {
            let live: bool = self.conn.query_row(
                "SELECT EXISTS(SELECT 1 FROM presence WHERE document=? AND owner=? AND dirty=1)",
                params![draft.document.id, draft.writer],
                |r| r.get(0),
            )?;
            if !live || draft.writer.starts_with(owner_prefix) {
                result.push(draft);
            }
        }
        Ok(result)
    }

    pub fn claim_recovery_drafts(
        &mut self,
        workspace: &str,
        owner_prefix: &str,
    ) -> Result<Vec<Draft>> {
        let mut drafts = self.recovery_drafts(workspace, owner_prefix)?;
        let tx = self.conn.transaction()?;
        for draft in &mut drafts {
            let old_writer = draft.writer.clone();
            draft.writer = format!("{owner_prefix}{}", id());
            draft.sequence = now() * 1000;
            let hash = put_object(&tx, draft.content.as_bytes())?;
            tx.execute(
                "UPDATE drafts SET hash=NULL,sequence=? WHERE document=? AND writer=?",
                params![i64::MAX, draft.document.id, old_writer],
            )?;
            tx.execute(
                "DELETE FROM presence WHERE document=? AND owner=?",
                params![draft.document.id, old_writer],
            )?;
            tx.execute(
                "INSERT INTO drafts VALUES(?,?,?,?,?,?,?)",
                params![
                    draft.document.id,
                    draft.writer,
                    draft.sequence,
                    hash,
                    draft.disk_revision,
                    draft.paused,
                    now()
                ],
            )?;
            tx.execute(
                "INSERT INTO presence VALUES(?,?,1)",
                params![draft.document.id, draft.writer],
            )?;
        }
        tx.commit()?;
        Ok(drafts)
    }

    pub fn boundary(&mut self, doc: &Document) -> Result<()> {
        self.check(doc)?;
        self.conn
            .execute("UPDATE entries SET active=0 WHERE document=?", [&doc.id])?;
        self.conn.execute(
            "UPDATE sessions SET state='interrupted' WHERE document=? AND state='active'",
            [&doc.id],
        )?;
        Ok(())
    }

    /// One mutable result per external batch. The baseline is never replaced.
    pub fn external(
        &mut self,
        doc: &Document,
        before: &str,
        after: &str,
    ) -> Result<Option<String>> {
        self.check(doc)?;
        if !self.enabled()? || before == after {
            return Ok(None);
        }
        // A delayed watcher event after CLI commit must not start a second version.
        let already_observed: bool = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM baselines WHERE document=? AND hash=?)",
            params![doc.id, digest(after.as_bytes())],
            |r| r.get(0),
        )?;
        if already_observed {
            return Ok(None);
        }
        let tx = self.conn.transaction()?;
        let after_hash = put_object(&tx, after.as_bytes())?;
        let active: Option<String> = tx
            .query_row(
                "SELECT id FROM entries WHERE document=? AND active=1",
                [&doc.id],
                |r| r.get(0),
            )
            .optional()?;
        let entry = if let Some(active) = active {
            tx.execute(
                "UPDATE entries SET after_hash=?,updated=? WHERE id=? AND after_hash<>?",
                params![after_hash, now(), active, after_hash],
            )?;
            active
        } else {
            let before_hash = put_object(&tx, before.as_bytes())?;
            insert_entry(
                &tx,
                &doc.id,
                "external",
                "",
                Some(&before_hash),
                &after_hash,
                true,
            )?
        };
        tx.execute("INSERT INTO baselines VALUES(?,?) ON CONFLICT(document) DO UPDATE SET hash=excluded.hash",params![doc.id,after_hash])?;
        tx.commit()?;
        Ok(Some(entry))
    }

    pub fn checkpoint(
        &mut self,
        doc: &Document,
        before: Option<&[u8]>,
        after: &[u8],
        kind: &str,
        message: &str,
    ) -> Result<Option<String>> {
        self.check(doc)?;
        if !self.enabled()? {
            return Ok(None);
        }
        if matches!(kind, "checkpoint" | "opened") && self.used_bytes()? >= BUDGET {
            return Ok(None);
        }
        let tx = self.conn.transaction()?;
        let hash = put_object(&tx, after)?;
        let baseline = before.map(|body| put_object(&tx, body)).transpose()?;
        let previous: Option<(String,String,i64,String)> = tx.query_row("SELECT id,after_hash,updated,kind FROM entries WHERE document=? ORDER BY updated DESC LIMIT 1", [&doc.id], |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?))).optional()?;
        if let Some((entry, old, time, old_kind)) = previous {
            if old == hash && !matches!(kind, "restore" | "discard" | "overwrite") {
                tx.commit()?;
                return Ok(Some(entry));
            }
            if old_kind == kind
                && matches!(kind, "autosave" | "checkpoint")
                && now() - time < if kind == "autosave" { 30_000 } else { 60_000 }
            {
                tx.execute(
                    "UPDATE entries SET after_hash=?,updated=? WHERE id=?",
                    params![hash, now(), entry],
                )?;
                tx.commit()?;
                return Ok(Some(entry));
            }
        }
        let entry = insert_entry(
            &tx,
            &doc.id,
            kind,
            message,
            baseline.as_deref(),
            &hash,
            false,
        )?;
        tx.commit()?;
        Ok(Some(entry))
    }

    pub fn begin(
        &mut self,
        doc: &Document,
        request: &str,
        baseline: Option<&str>,
    ) -> Result<Value> {
        self.check(doc)?;
        if !self.enabled()? {
            bail!("history_disabled");
        }
        if let Some((session, owner)) = self
            .conn
            .query_row(
                "SELECT id,document FROM sessions WHERE request=?",
                [request],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
            )
            .optional()?
        {
            if owner != doc.id {
                bail!("request_conflict");
            }
            return self.session(&session);
        }
        let occupied: bool = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM sessions WHERE document=? AND state='active')",
            [&doc.id],
            |r| r.get(0),
        )?;
        if occupied {
            bail!("history_session_busy");
        }
        if self.used_bytes()? >= BUDGET {
            bail!("history_budget_exceeded");
        }
        let dirty: bool = self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM presence WHERE document=?1 AND dirty=1) OR EXISTS(SELECT 1 FROM drafts WHERE document=?1 AND hash IS NOT NULL)",
            [&doc.id],
            |r| r.get(0),
        )?;
        if dirty {
            bail!("content_conflict");
        }
        let tx = self.conn.transaction()?;
        tx.execute("UPDATE entries SET active=0 WHERE document=?", [&doc.id])?;
        let hash = put_object(&tx, baseline.unwrap_or("").as_bytes())?;
        let entry = insert_entry(
            &tx,
            &doc.id,
            "ai",
            "",
            baseline.map(|_| hash.as_str()),
            &hash,
            true,
        )?;
        let session = id();
        tx.execute(
            "INSERT INTO sessions VALUES(?,?,?,?,?,'active',NULL)",
            params![session, request, doc.id, doc.generation, entry],
        )?;
        tx.commit()?;
        self.session(&session)
    }

    pub fn session(&self, session: &str) -> Result<Value> {
        Ok(self.conn.query_row("SELECT id,document,state,entry,result,generation FROM sessions WHERE id=?", [session], |r| Ok(json!({"sessionId":r.get::<_,String>(0)?,"documentId":r.get::<_,String>(1)?,"state":r.get::<_,String>(2)?,"versionId":r.get::<_,Option<String>>(3)?,"result":r.get::<_,Option<String>>(4)?.and_then(|s|serde_json::from_str::<Value>(&s).ok()),"generation":r.get::<_,i64>(5)?})))?)
    }

    pub fn commit(
        &mut self,
        session: &str,
        content: &str,
        expected: &str,
        message: &str,
    ) -> Result<Value> {
        let state = self.session(session)?;
        if state["state"] == "committed" {
            if state["result"]["sha256"] != expected || state["result"]["message"] != message {
                bail!("request_conflict");
            }
            return Ok(state["result"].clone());
        }
        if !self.enabled()? {
            bail!("history_disabled");
        }
        if state["state"] != "active" {
            bail!("history_invalidated");
        }
        let doc = self.document(state["documentId"].as_str().context("document")?)?;
        if doc.generation != state["generation"].as_i64().unwrap_or(-1) {
            bail!("history_invalidated");
        }
        if digest(content.as_bytes()) != expected {
            bail!("content_changed");
        }
        let entry = state["versionId"].as_str().context("entry")?;
        let tx = self.conn.transaction()?;
        let hash = put_object(&tx, content.as_bytes())?;
        let baseline: Option<String> =
            tx.query_row("SELECT before_hash FROM entries WHERE id=?", [entry], |r| {
                r.get(0)
            })?;
        let unchanged = baseline.as_deref() == Some(&hash);
        let result = json!({"versionId":if unchanged {None} else {Some(entry)},"sha256":hash,"message":message,"code":if unchanged {"no_changes"} else {"history_committed"}});
        tx.execute(
            "UPDATE entries SET active=0,after_hash=?,message=?,updated=? WHERE id=?",
            params![hash, message, now(), entry],
        )?;
        if unchanged {
            tx.execute("DELETE FROM entries WHERE id=?", [entry])?;
        }
        tx.execute(
            "UPDATE sessions SET state='committed',result=? WHERE id=?",
            params![result.to_string(), session],
        )?;
        tx.execute("INSERT INTO baselines VALUES(?,?) ON CONFLICT(document) DO UPDATE SET hash=excluded.hash",params![doc.id,hash])?;
        tx.commit()?;
        Ok(result)
    }

    pub fn list(
        &self,
        workspace: Option<&str>,
        document: Option<&str>,
        offset: i64,
    ) -> Result<Vec<Entry>> {
        let mut stmt=self.conn.prepare("SELECT e.id,e.document,d.name,d.path,e.kind,e.message,e.created,e.updated,e.active,e.before_hash,e.after_hash FROM entries e JOIN documents d ON d.id=e.document WHERE (?1 IS NULL OR d.workspace=?1) AND (?2 IS NULL OR e.document=?2) ORDER BY e.updated DESC,e.id LIMIT 50 OFFSET ?3")?;
        let rows = stmt
            .query_map(params![workspace, document, offset.max(0)], |r| {
                Ok(Entry {
                    id: r.get(0)?,
                    document_id: r.get(1)?,
                    name: r.get(2)?,
                    path: r.get(3)?,
                    kind: r.get(4)?,
                    message: r.get(5)?,
                    created_at: r.get(6)?,
                    updated_at: r.get(7)?,
                    active: r.get(8)?,
                    before_hash: r.get(9)?,
                    after_hash: r.get(10)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn entry_exists(&self, entry: &str) -> Result<bool> {
        Ok(self.conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM entries WHERE id=?)",
            [entry],
            |r| r.get(0),
        )?)
    }

    pub fn read_entry(&self, entry: &str, before: bool) -> Result<(Document, String)> {
        let (doc,hash,bytes):(String,String,Vec<u8>)=self.conn.query_row("SELECT document,objects.hash,body FROM entries JOIN objects ON objects.hash=CASE WHEN ?2 THEN before_hash ELSE after_hash END WHERE entries.id=?1",params![entry,before],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?)))?;
        if digest(&bytes) != hash {
            bail!("history_corrupt");
        }
        Ok((self.document(&doc)?, (self.decode)(bytes)?))
    }

    pub fn stats(&self, workspace: Option<&str>) -> Result<Value> {
        let count:i64=self.conn.query_row("SELECT COUNT(*) FROM entries JOIN documents ON document=documents.id WHERE ?1 IS NULL OR workspace=?1",[workspace],|r|r.get(0))?;
        let bytes:i64=self.conn.query_row("SELECT COALESCE(SUM(length(body)),0) FROM objects WHERE hash IN (SELECT before_hash FROM entries JOIN documents ON document=documents.id WHERE ?1 IS NULL OR workspace=?1 UNION SELECT after_hash FROM entries JOIN documents ON document=documents.id WHERE ?1 IS NULL OR workspace=?1) AND hash NOT IN (SELECT b.hash FROM baselines b JOIN documents d ON b.document=d.id WHERE ?1 IS NOT NULL AND d.workspace<>?1 UNION SELECT hash FROM drafts WHERE hash IS NOT NULL UNION SELECT before_hash FROM writes WHERE before_hash IS NOT NULL UNION SELECT after_hash FROM writes UNION SELECT before_hash FROM entries JOIN documents ON document=documents.id WHERE ?1 IS NOT NULL AND workspace<>?1 AND before_hash IS NOT NULL UNION SELECT after_hash FROM entries JOIN documents ON document=documents.id WHERE ?1 IS NOT NULL AND workspace<>?1)",[workspace],|r|r.get(0))?;
        let used = self.used_bytes()?;
        Ok(
            json!({"count":count,"reclaimableBytes":bytes,"enabled":self.enabled()?,"usedBytes":used,"budgetBytes":BUDGET,"budgetLimited":used>=BUDGET}),
        )
    }

    pub fn clear(&mut self, workspace: Option<&str>) -> Result<Value> {
        let result = self.stats(workspace)?;
        let tx = self.conn.transaction()?;
        tx.execute(
            "UPDATE scopes SET generation=generation+1 WHERE ?1 IS NULL OR id=?1",
            [workspace],
        )?;
        tx.execute("UPDATE sessions SET state='invalidated',result=NULL,entry=NULL WHERE document IN (SELECT id FROM documents WHERE ?1 IS NULL OR workspace=?1)",[workspace])?;
        tx.execute("UPDATE receipts SET result='{\"invalidated\":true}' WHERE json_extract(result,'$.result.versionId') IN (SELECT e.id FROM entries e JOIN documents d ON e.document=d.id WHERE ?1 IS NULL OR workspace=?1)",[workspace])?;
        tx.execute("DELETE FROM entries WHERE document IN (SELECT id FROM documents WHERE ?1 IS NULL OR workspace=?1)",[workspace])?;
        tx.execute("DELETE FROM baselines WHERE document IN (SELECT id FROM documents WHERE ?1 IS NULL OR workspace=?1)",[workspace])?;
        tx.execute("UPDATE writes SET state='cleared' WHERE document IN (SELECT id FROM documents WHERE ?1 IS NULL OR workspace=?1)",[workspace])?;
        tx.commit()?;
        self.gc()?;
        self.conn
            .execute_batch("PRAGMA incremental_vacuum; PRAGMA wal_checkpoint(TRUNCATE);")?;
        Ok(result)
    }

    pub fn prepare_write(
        &mut self,
        doc: &Document,
        before: Option<&[u8]>,
        after: &[u8],
    ) -> Result<String> {
        self.check(doc)?;
        let enabled = self.enabled()?;
        let tx = self.conn.transaction()?;
        let baseline = before.map(|b| put_object(&tx, b)).transpose()?;
        let hash = put_object(&tx, after)?;
        let operation = id();
        tx.execute(
            "INSERT INTO writes VALUES(?,?,?,?,'pending',?)",
            params![operation, doc.id, baseline, hash, now()],
        )?;
        if enabled {
            tx.execute(
                "INSERT INTO entries VALUES(?,?, 'write-pending','',?,?,0,?,?)",
                params![operation, doc.id, now(), now(), baseline, hash],
            )?;
        }
        tx.commit()?;
        Ok(operation)
    }

    pub fn complete_write(&mut self, operation: &str, kind: &str) -> Result<Option<String>> {
        let enabled = self.enabled()?;
        let tx = self.conn.transaction()?;
        let (doc, baseline, hash, state): (String, Option<String>, String, String) = tx.query_row(
            "SELECT document,before_hash,after_hash,state FROM writes WHERE id=?",
            [operation],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )?;
        tx.execute("UPDATE entries SET active=0 WHERE document=?", [&doc])?;
        tx.execute(
            "UPDATE sessions SET state='interrupted' WHERE document=? AND state='active'",
            [&doc],
        )?;
        tx.execute("DELETE FROM entries WHERE id=?", [operation])?;
        let previous:Option<(String,String,i64,String,Option<String>)>=tx.query_row("SELECT id,after_hash,created,kind,before_hash FROM entries WHERE document=? ORDER BY updated DESC LIMIT 1",[&doc],|r|Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?))).optional()?;
        let entry = if enabled && state != "cleared" {
            if let Some((entry, _, _, _, _)) =
                previous.filter(|(_, old, time, old_kind, old_before)| {
                    (old == &hash && (old_before.is_none() || old_before == &baseline))
                        || (kind == "autosave" && old_kind == kind && now() - time < 30_000)
                })
            {
                tx.execute(
                    "UPDATE entries SET after_hash=?,before_hash=COALESCE(before_hash,?),updated=?,kind=CASE WHEN kind IN ('checkpoint','opened') OR ?='overwrite' THEN ? ELSE kind END WHERE id=?",
                    params![hash, baseline, now(), kind, kind, entry],
                )?;
                Some(entry)
            } else {
                Some(insert_entry(
                    &tx,
                    &doc,
                    kind,
                    "",
                    baseline.as_deref(),
                    &hash,
                    false,
                )?)
            }
        } else {
            None
        };
        tx.execute("INSERT INTO baselines VALUES(?,?) ON CONFLICT(document) DO UPDATE SET hash=excluded.hash",params![doc,hash])?;
        tx.execute("DELETE FROM writes WHERE id=?", [operation])?;
        tx.commit()?;
        Ok(entry)
    }

    pub fn recover_write(&mut self, operation: &str) -> Result<()> {
        let (doc, hash, before): (String, String, Option<Vec<u8>>) = self.conn.query_row(
            "SELECT document,after_hash,body FROM writes LEFT JOIN objects ON before_hash=objects.hash WHERE id=?",
            [operation],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )?;
        let before = before.map(self.decode).transpose()?;
        let tx = self.conn.transaction()?;
        if let Some(before) = before {
            let backup = put_object(&tx, before.as_bytes())?;
            tx.execute(
                "INSERT OR IGNORE INTO drafts VALUES(?,?,0,?,NULL,1,?)",
                params![
                    doc,
                    format!("interrupted-before:{operation}"),
                    backup,
                    now()
                ],
            )?;
        }
        tx.execute(
            "INSERT OR IGNORE INTO drafts VALUES(?,?,0,?,NULL,1,?)",
            params![doc, format!("interrupted:{operation}"), hash, now()],
        )?;
        // Consume the journal only after both recovery drafts are durable.
        tx.execute("DELETE FROM writes WHERE id=?", [operation])?;
        tx.commit()?;
        Ok(())
    }

    pub fn cancel_write(&mut self, operation: &str) -> Result<()> {
        let tx = self.conn.transaction()?;
        tx.execute("DELETE FROM entries WHERE id=?", [operation])?;
        tx.execute("DELETE FROM writes WHERE id=?", [operation])?;
        tx.commit()?;
        Ok(())
    }

    pub fn pending_writes(&self) -> Result<Vec<Value>> {
        let mut stmt=self.conn.prepare("SELECT w.id,d.path,w.before_hash,w.after_hash FROM writes w JOIN documents d ON d.id=w.document")?;
        let rows=stmt.query_map([],|r|Ok(json!({"id":r.get::<_,String>(0)?,"path":r.get::<_,Option<String>>(1)?,"beforeHash":r.get::<_,Option<String>>(2)?,"afterHash":r.get::<_,String>(3)?})))?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn gc(&mut self) -> Result<()> {
        let cutoff = now() - 30 * DAY;
        self.conn
            .execute("DELETE FROM entries WHERE active=0 AND updated<?", [cutoff])?;
        self.conn.execute("DELETE FROM entries WHERE id IN (SELECT id FROM (SELECT id,kind,updated,active,ROW_NUMBER() OVER(PARTITION BY document ORDER BY updated DESC) n FROM entries) WHERE n>100 AND active=0 AND (kind IN ('opened','checkpoint','autosave','save','recovered-save') OR updated<?))",[now()-7*DAY])?;
        self.collect_objects()?;
        let size: i64 = self.conn.query_row(
            "SELECT COALESCE(SUM(length(body)),0) FROM objects",
            [],
            |r| r.get(0),
        )?;
        if size > BUDGET {
            self.conn.execute("DELETE FROM entries WHERE id IN (SELECT id FROM entries WHERE active=0 AND updated<? ORDER BY updated LIMIT 100)",[now()-7*DAY])?;
            self.collect_objects()?;
        }
        self.conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);")?;
        Ok(())
    }

    fn collect_objects(&mut self) -> Result<()> {
        self.conn.execute("DELETE FROM objects WHERE hash NOT IN (SELECT before_hash FROM entries WHERE before_hash IS NOT NULL UNION SELECT after_hash FROM entries UNION SELECT hash FROM drafts WHERE hash IS NOT NULL UNION SELECT before_hash FROM writes WHERE before_hash IS NOT NULL UNION SELECT after_hash FROM writes UNION SELECT hash FROM baselines)",[])?;
        Ok(())
    }
}

fn document_row(r: &rusqlite::Row<'_>) -> rusqlite::Result<Document> {
    Ok(Document {
        id: r.get(0)?,
        workspace: r.get(1)?,
        path: r.get(2)?,
        name: r.get(3)?,
        generation: r.get(4)?,
    })
}
fn put_object(tx: &Transaction<'_>, body: &[u8]) -> Result<String> {
    let hash = digest(body);
    tx.execute(
        "INSERT OR IGNORE INTO objects VALUES(?,?)",
        params![hash, body],
    )?;
    Ok(hash)
}
fn insert_entry(
    tx: &Transaction<'_>,
    doc: &str,
    kind: &str,
    message: &str,
    before: Option<&str>,
    after: &str,
    active: bool,
) -> Result<String> {
    let entry = id();
    tx.execute(
        "INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?)",
        params![
            entry,
            doc,
            kind,
            message,
            now(),
            now(),
            active,
            before,
            after
        ],
    )?;
    Ok(entry)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> (tempfile::TempDir, Store, Document) {
        let dir = tempfile::tempdir().unwrap();
        let mut s = Store::open(&dir.path().join("history.db")).unwrap();
        let d = s
            .register("/w/a.md", "/w", Some("/w/a.md"), "a.md")
            .unwrap();
        (dir, s, d)
    }
    #[test]
    fn thousand_external_changes_are_one_recoverable_entry() {
        let (_dir, mut s, d) = setup();
        for n in 0..1000 {
            s.external(&d, "baseline", &n.to_string()).unwrap();
        }
        let entries = s.list(None, None, 0).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(s.read_entry(&entries[0].id, true).unwrap().1, "baseline");
        assert_eq!(s.read_entry(&entries[0].id, false).unwrap().1, "999");
    }
    #[test]
    fn clear_invalidates_sessions_and_late_observations_but_preserves_drafts() {
        let (_dir, mut s, d) = setup();
        let batch = s.begin(&d, "request", Some("old")).unwrap();
        s.put_draft(&Draft {
            document: d.clone(),
            writer: "window".into(),
            sequence: 1,
            content: "unsaved".into(),
            disk_revision: None,
            paused: true,
        })
        .unwrap();
        s.clear(Some("/w")).unwrap();
        assert!(s.external(&d, "old", "late").is_err());
        assert!(s
            .commit(
                batch["sessionId"].as_str().unwrap(),
                "new",
                &digest(b"new"),
                ""
            )
            .is_err());
        assert_eq!(s.drafts("/w").unwrap()[0].content, "unsaved");
        assert!(s.list(None, None, 0).unwrap().is_empty());
    }
    #[test]
    fn commit_is_idempotent_and_survives_restart() {
        let (dir, mut s, d) = setup();
        let batch = s.begin(&d, "request", Some("old")).unwrap();
        let session = batch["sessionId"].as_str().unwrap();
        s.external(&d, "old", "intermediate").unwrap();
        let r = s
            .commit(session, "new", &digest(b"new"), "AI edit")
            .unwrap();
        drop(s);
        let mut s = Store::open(&dir.path().join("history.db")).unwrap();
        assert_eq!(
            s.commit(session, "new", &digest(b"new"), "AI edit")
                .unwrap(),
            r
        );
        assert_eq!(s.list(None, None, 0).unwrap().len(), 1);
    }
    #[test]
    fn saved_draft_tombstone_rejects_late_content() {
        let (_dir, mut s, d) = setup();
        s.finish_draft(&d.id, "w", 3).unwrap();
        assert!(!s
            .put_draft(&Draft {
                document: d,
                writer: "w".into(),
                sequence: 2,
                content: "old".into(),
                disk_revision: None,
                paused: false
            })
            .unwrap());
        assert!(s.drafts("/w").unwrap().is_empty());
    }
    #[test]
    fn disabled_history_keeps_drafts_and_old_versions() {
        let (_dir, mut s, d) = setup();
        s.external(&d, "old", "new").unwrap();
        s.set_enabled(false).unwrap();
        let d = s.document(&d.id).unwrap();
        assert!(s.external(&d, "new", "next").unwrap().is_none());
        assert_eq!(s.list(None, None, 0).unwrap().len(), 1);
        assert!(s.begin(&d, "request", Some("next")).is_err());
    }
    #[test]
    fn workspace_clear_does_not_delete_other_workspaces() {
        let (_dir, mut s, d) = setup();
        let other = s
            .register("/x/b.md", "/x", Some("/x/b.md"), "b.md")
            .unwrap();
        s.external(&d, "same", "new").unwrap();
        s.external(&other, "same", "new").unwrap();
        s.clear(Some("/w")).unwrap();
        let e = s.list(None, None, 0).unwrap();
        assert_eq!(e.len(), 1);
        assert_eq!(s.read_entry(&e[0].id, true).unwrap().1, "same");
    }
    #[test]
    fn save_preparation_remains_recoverable_after_a_crash() {
        let (dir, mut s, d) = setup();
        let operation = s.prepare_write(&d, Some(b"original"), b"target").unwrap();
        drop(s);
        let mut s = Store::open(&dir.path().join("history.db")).unwrap();
        assert_eq!(s.read_entry(&operation, true).unwrap().1, "original");
        s.recover_write(&operation).unwrap();
        let drafts = s.drafts("/w").unwrap();
        assert_eq!(drafts.len(), 2);
        assert!(drafts.iter().any(|d| d.content == "target"));
        assert!(drafts.iter().any(|d| d.content == "original"));
        assert!(s.pending_writes().unwrap().is_empty());
        assert_eq!(s.list(None, None, 0).unwrap().len(), 1);
    }
    #[test]
    fn autosave_merges_and_manual_save_seals_external_batches() {
        let (_dir, mut s, d) = setup();
        for value in [b"one".as_slice(), b"two", b"three"] {
            let operation = s.prepare_write(&d, Some(b"base"), value).unwrap();
            s.complete_write(&operation, "autosave").unwrap();
        }
        let entries = s.list(None, None, 0).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(s.read_entry(&entries[0].id, true).unwrap().1, "base");
        assert_eq!(s.read_entry(&entries[0].id, false).unwrap().1, "three");
    }
    #[test]
    fn committed_ai_result_is_not_recorded_again_on_reopen() {
        let (_dir, mut s, d) = setup();
        s.observe(&d, "base").unwrap();
        let b = s.begin(&d, "r", Some("base")).unwrap();
        s.commit(
            b["sessionId"].as_str().unwrap(),
            "result",
            &digest(b"result"),
            "",
        )
        .unwrap();
        s.observe(&d, "result").unwrap();
        assert_eq!(s.list(None, None, 0).unwrap().len(), 2);
    }
    #[test]
    fn restore_is_atomic_and_keeps_pause_even_with_history_disabled() {
        let (_dir, mut s, d) = setup();
        let entry = s.external(&d, "first", "second").unwrap().unwrap();
        s.set_enabled(false).unwrap();
        let d = s.document(&d.id).unwrap();
        let draft = Draft {
            document: d,
            writer: "w".into(),
            sequence: 1,
            content: "".into(),
            disk_revision: Some("rev".into()),
            paused: false,
        };
        let restored = s.restore(&entry, true, draft.clone(), "working").unwrap();
        assert_eq!(restored.content, "first");
        assert!(restored.paused);
        assert_eq!(s.drafts("/w").unwrap().len(), 2);
        s.clear(None).unwrap();
        assert!(s.restore(&entry, true, draft, "more").is_err());
        assert_eq!(s.drafts("/w").unwrap().len(), 2);
    }
    #[test]
    fn clear_then_reopen_does_not_recreate_history() {
        let (_dir, mut s, d) = setup();
        s.observe(&d, "base").unwrap();
        s.clear(None).unwrap();
        let d = s.document(&d.id).unwrap();
        s.observe(&d, "base").unwrap();
        assert!(s.list(None, None, 0).unwrap().is_empty());
        s.observe(&d, "changed").unwrap();
        assert_eq!(s.list(None, None, 0).unwrap().len(), 1);
    }
    #[test]
    fn a_dirty_other_window_blocks_ai_begin() {
        let (_dir, mut s, d) = setup();
        s.presence(&d.id, "other", true).unwrap();
        assert!(s
            .begin(&d, "r", Some("base"))
            .unwrap_err()
            .to_string()
            .contains("content_conflict"));
        s.presence(&d.id, "other", false).unwrap();
        assert!(s.begin(&d, "r", Some("base")).is_ok());
    }
    #[test]
    fn wrong_hash_does_not_close_or_mutate_the_ai_session() {
        let (_dir, mut s, d) = setup();
        let b = s.begin(&d, "r", Some("base")).unwrap();
        let session = b["sessionId"].as_str().unwrap();
        assert!(s
            .commit(session, "different", &digest(b"expected"), "")
            .is_err());
        assert_eq!(s.session(session).unwrap()["state"], "active");
        assert_eq!(
            s.read_entry(b["versionId"].as_str().unwrap(), true)
                .unwrap()
                .1,
            "base"
        );
    }
    #[test]
    fn delayed_watcher_after_commit_does_not_duplicate_the_batch() {
        let (_dir, mut s, d) = setup();
        let b = s.begin(&d, "edit", Some("original")).unwrap();
        let session = b["sessionId"].as_str().unwrap();
        s.commit(session, "final", &digest(b"final"), "AI edit")
            .unwrap();
        assert!(s.external(&d, "original", "final").unwrap().is_none());
        assert_eq!(s.list(None, None, 0).unwrap().len(), 1);
    }
    #[test]
    fn clearing_a_pending_write_cannot_recreate_versions_on_completion() {
        let (_dir, mut s, d) = setup();
        let operation = s.prepare_write(&d, Some(b"old"), b"new").unwrap();
        s.clear(None).unwrap();
        assert!(s
            .complete_write(&operation, "recovered-save")
            .unwrap()
            .is_none());
        assert!(s.list(None, None, 0).unwrap().is_empty());
    }
    #[test]
    fn canceled_conditional_write_leaves_no_pending_recovery() {
        let (_dir, mut s, d) = setup();
        let operation = s.prepare_write(&d, Some(b"old"), b"new").unwrap();
        s.cancel_write(&operation).unwrap();
        assert!(s.pending_writes().unwrap().is_empty());
        assert!(s.list(None, None, 0).unwrap().is_empty());
    }
    #[test]
    fn cleared_save_receipts_are_invalidated_instead_of_replayed() {
        let (_dir, mut s, d) = setup();
        let entry = s
            .checkpoint(&d, None, b"saved", "save", "")
            .unwrap()
            .unwrap();
        s.record_receipt(
            "save-id",
            "fingerprint",
            &json!({"code":"file_saved","result":{"versionId":entry}}),
        )
        .unwrap();
        s.clear(Some("/w")).unwrap();
        assert!(s
            .receipt("save-id", "fingerprint")
            .unwrap_err()
            .to_string()
            .contains("history_invalidated"));
    }
    #[test]
    fn damaged_content_is_rejected_before_restore() {
        let (_dir, mut s, d) = setup();
        let entry = s
            .checkpoint(&d, None, b"good", "save", "")
            .unwrap()
            .unwrap();
        s.conn
            .execute(
                "UPDATE objects SET body=x'626164' WHERE hash=?",
                [digest(b"good")],
            )
            .unwrap();
        assert!(s
            .read_entry(&entry, false)
            .unwrap_err()
            .to_string()
            .contains("history_corrupt"));
    }
    #[test]
    fn rename_preserves_document_and_moves_workspace_scope() {
        let (_dir, mut s, d) = setup();
        let entry = s.external(&d, "old", "new").unwrap().unwrap();
        s.rebase("/w", "/renamed").unwrap();
        let renamed = s
            .register("/renamed/a.md", "/renamed", Some("/renamed/a.md"), "a.md")
            .unwrap();
        assert_eq!(renamed.id, d.id);
        assert!(renamed.generation > d.generation);
        assert_eq!(s.list(Some("/renamed"), None, 0).unwrap()[0].id, entry);
        s.clear(Some("/renamed")).unwrap();
        assert!(s.list(None, None, 0).unwrap().is_empty());
    }
    #[test]
    fn recovery_leaves_another_live_windows_draft_alone() {
        let (_dir, mut s, d) = setup();
        s.put_draft(&Draft {
            document: d.clone(),
            writer: "other:file".into(),
            sequence: 1,
            content: "working".into(),
            disk_revision: None,
            paused: false,
        })
        .unwrap();
        s.presence(&d.id, "other:file", true).unwrap();
        assert!(s.recovery_drafts("/w", "main:").unwrap().is_empty());
        assert_eq!(s.recovery_drafts("/w", "other:").unwrap().len(), 1);
        s.reset_presence().unwrap();
        assert_eq!(s.recovery_drafts("/w", "main:").unwrap().len(), 1);
    }

    #[test]
    fn deduplicated_save_still_retains_the_overwritten_disk_bytes() {
        let (_dir, mut s, d) = setup();
        s.checkpoint(&d, None, b"draft", "checkpoint", "").unwrap();
        let write = s
            .prepare_write(&d, Some(b"disk original"), b"draft")
            .unwrap();
        let entry = s.complete_write(&write, "save").unwrap().unwrap();
        assert_eq!(s.list(None, None, 0).unwrap().len(), 1);
        assert_eq!(s.read_entry(&entry, true).unwrap().1, "disk original");
    }
    #[test]
    fn budget_limits_ordinary_checkpoints_but_keeps_drafts_and_safety_copies() {
        let (_dir, mut s, d) = setup();
        s.conn
            .execute("UPDATE config SET value=? WHERE key='bytes'", [BUDGET])
            .unwrap();
        assert!(s
            .checkpoint(&d, None, b"ordinary", "checkpoint", "")
            .unwrap()
            .is_none());
        assert!(s.begin(&d, "edit", Some("old")).is_err());
        s.put_draft(&Draft {
            document: d.clone(),
            writer: "w".into(),
            sequence: 1,
            content: "working".into(),
            disk_revision: None,
            paused: false,
        })
        .unwrap();
        assert_eq!(s.drafts("/w").unwrap()[0].content, "working");
        assert!(s.external(&d, "old", "new").unwrap().is_some());
        assert_eq!(s.stats(None).unwrap()["budgetLimited"], true);
    }
    #[test]
    fn a_recovered_draft_is_claimed_by_only_one_window() {
        let (_dir, mut s, d) = setup();
        let draft = Draft {
            document: d.clone(),
            writer: "previous:file".into(),
            sequence: 1,
            content: "working".into(),
            disk_revision: None,
            paused: true,
        };
        s.put_draft(&draft).unwrap();
        let claimed = s.claim_recovery_drafts("/w", "first:").unwrap();
        assert_eq!(claimed.len(), 1);
        assert!(claimed[0].writer.starts_with("first:"));
        assert!(s.claim_recovery_drafts("/w", "second:").unwrap().is_empty());
        assert!(!s
            .put_draft(&Draft {
                sequence: 2,
                content: "late".into(),
                ..draft
            })
            .unwrap());
        assert_eq!(s.drafts("/w").unwrap()[0].content, "working");
    }
    #[test]
    fn deduplication_never_discards_a_different_overwritten_version() {
        let (_dir, mut s, d) = setup();
        s.checkpoint(&d, Some(b"earlier"), b"target", "save", "")
            .unwrap();
        let write = s
            .prepare_write(&d, Some(b"current disk"), b"target")
            .unwrap();
        let entry = s.complete_write(&write, "overwrite").unwrap().unwrap();
        assert_eq!(s.read_entry(&entry, true).unwrap().1, "current disk");
    }
    #[test]
    fn rename_rejects_a_late_observation_for_the_previous_path() {
        let (_dir, mut s, d) = setup();
        s.rebase("/w/a.md", "/w/b.md").unwrap();
        assert!(s
            .external(&d, "old file", "replacement at old path")
            .is_err());
        let next = s
            .register("/w/b.md", "/w", Some("/w/b.md"), "b.md")
            .unwrap();
        assert_eq!(next.id, d.id);
        assert!(s.external(&next, "before", "after").is_ok());
    }
    #[test]
    fn an_unclaimed_persisted_draft_blocks_ai_begin() {
        let (_dir, mut s, d) = setup();
        s.put_draft(&Draft {
            document: d.clone(),
            writer: "previous:file".into(),
            sequence: 1,
            content: "working".into(),
            disk_revision: None,
            paused: true,
        })
        .unwrap();
        assert!(s
            .begin(&d, "edit", Some("disk"))
            .unwrap_err()
            .to_string()
            .contains("content_conflict"));
        assert!(s.list(None, None, 0).unwrap().is_empty());
    }
}
