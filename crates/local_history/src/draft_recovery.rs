//! Recovery lists references only. Reading and claiming a body is one transaction.
use super::{document_row, path_identity, snapshots, Document, Draft, Store};
use anyhow::{bail, Result};
use mf_text_encoding::TextFileFormat;
use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftDescriptor {
    pub document: Document,
    pub writer: String,
    pub sequence: i64,
    pub hash: String,
    pub disk_revision: Option<String>,
    pub paused: bool,
    #[serde(default)]
    pub format: Option<TextFileFormat>,
}

fn descriptor(conn: &Connection, document: &str, writer: &str) -> Result<Option<DraftDescriptor>> {
    let row = conn.query_row(
        "SELECT d.id,d.workspace,d.path,d.name,s.generation,r.writer,r.sequence,r.hash,r.disk_revision,r.paused
         FROM drafts r JOIN documents d ON d.id=r.document JOIN scopes s ON s.id=d.workspace
         WHERE r.document=? AND r.writer=? AND r.hash IS NOT NULL",
        params![document, writer],
        |r| Ok(DraftDescriptor {
            document: document_row(r)?, writer: r.get(5)?, sequence: r.get(6)?,
            hash: r.get(7)?, disk_revision: r.get(8)?, paused: r.get(9)?, format: None,
        }),
    ).optional()?;
    row.map(|mut row| {
        row.format = snapshots::get(
            conn,
            &snapshots::draft_owner(document, writer),
            "draft",
            &row.hash,
        )?
        .and_then(|(_, format)| format);
        Ok(row)
    })
    .transpose()
}

fn live(conn: &Connection, document: &str, writer: &str) -> Result<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM presence WHERE document=? AND owner=? AND dirty=1)",
        params![document, writer],
        |r| r.get(0),
    )?)
}

fn validate(expected: &DraftDescriptor, current: &DraftDescriptor) -> Result<()> {
    if expected.document.id != current.document.id
        || expected.document.workspace != current.document.workspace
        || expected.document.generation != current.document.generation
        || expected.document.path.as_deref().map(path_identity)
            != current.document.path.as_deref().map(path_identity)
    {
        bail!("history_invalidated");
    }
    if expected.sequence != current.sequence
        || expected.hash != current.hash
        || expected.disk_revision != current.disk_revision
        || expected.paused != current.paused
        || expected.format != current.format
    {
        bail!("history_draft_changed");
    }
    Ok(())
}

fn read(conn: &Connection, draft: &DraftDescriptor) -> Result<Draft> {
    let bytes: Vec<u8> = conn.query_row(
        "SELECT body FROM objects WHERE hash=?",
        [&draft.hash],
        |r| r.get(0),
    )?;
    if super::digest(&bytes) != draft.hash {
        bail!("history_corrupt");
    }
    Ok(Draft {
        document: draft.document.clone(),
        writer: draft.writer.clone(),
        sequence: draft.sequence,
        content: String::from_utf8(bytes)?,
        disk_revision: draft.disk_revision.clone(),
        paused: draft.paused,
        format: draft.format,
    })
}

impl Store {
    /// A window can close while another keeps the process (and history worker) alive.
    /// Drop only its liveness claim, never its draft or sequence tombstones.
    pub fn retain_window_presence(&mut self, owner_prefixes: &[String]) -> Result<()> {
        let owners = {
            let mut statement = self.conn.prepare("SELECT DISTINCT owner FROM presence")?;
            let rows = statement.query_map([], |r| r.get::<_, String>(0))?;
            rows.collect::<std::result::Result<Vec<_>, _>>()?
        };
        let tx = self.conn.transaction()?;
        for owner in owners {
            if !owner_prefixes
                .iter()
                .any(|prefix| owner.starts_with(prefix))
            {
                tx.execute("DELETE FROM presence WHERE owner=?", [&owner])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// No object body is selected or decoded, including for live or corrupt drafts.
    pub fn recovery_draft_index(
        &self,
        workspace: &str,
        owner_prefix: &str,
    ) -> Result<Vec<DraftDescriptor>> {
        if owner_prefix.is_empty() {
            bail!("invalid_draft_owner");
        }
        let mut statement = self.conn.prepare(
            "SELECT document,writer FROM drafts JOIN documents ON document=documents.id
             WHERE workspace=? AND hash IS NOT NULL ORDER BY updated,document,writer",
        )?;
        let rows = statement.query_map([workspace], |r| {
            Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?))
        })?;
        let mut result = Vec::new();
        for row in rows {
            let (document, writer) = row?;
            if !writer.starts_with(owner_prefix) && live(&self.conn, &document, &writer)? {
                continue;
            }
            if let Some(draft) = descriptor(&self.conn, &document, &writer)? {
                result.push(draft);
            }
        }
        Ok(result)
    }

    pub fn draft_descriptor(
        &self,
        document: &Document,
        writer: &str,
    ) -> Result<Option<DraftDescriptor>> {
        self.check(document)?;
        descriptor(&self.conn, &document.id, writer)
    }

    /// Revalidate the exact reference and presence under the write lock before reading.
    /// A stable claim id makes a retry after a lost IPC response safe and idempotent.
    pub fn claim_recovery_draft(
        &mut self,
        expected: &DraftDescriptor,
        owner_prefix: &str,
        claim_id: &str,
    ) -> Result<Option<Draft>> {
        if owner_prefix.is_empty() || claim_id.is_empty() {
            bail!("invalid_draft_owner");
        }
        let writer = format!("{owner_prefix}{claim_id}");
        if writer == expected.writer {
            bail!("invalid_draft_owner");
        }
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        // Even another Store/connection cannot change the source between these checks and commit.
        let current = descriptor(&tx, &expected.document.id, &expected.writer)?;
        if current.is_none() {
            let retired: bool = tx.query_row(
                "SELECT EXISTS(SELECT 1 FROM drafts WHERE document=? AND writer=? AND hash IS NULL AND sequence=?)",
                params![expected.document.id, expected.writer, i64::MAX], |r| r.get(0),
            )?;
            if retired {
                if let Some(claimed) = descriptor(&tx, &expected.document.id, &writer)? {
                    validate(expected, &claimed)?;
                    if live(&tx, &claimed.document.id, &writer)? {
                        let body = read(&tx, &claimed)?;
                        tx.commit()?;
                        return Ok(Some(body));
                    }
                }
            }
            return Ok(None);
        }
        let mut current = current.expect("checked above");
        validate(expected, &current)?;
        if !current.writer.starts_with(owner_prefix)
            && live(&tx, &current.document.id, &current.writer)?
        {
            return Ok(None);
        }
        // Checksum/UTF-8 errors leave ownership and the source reference untouched.
        let mut body = read(&tx, &current)?;
        snapshots::copy(
            &tx,
            &snapshots::draft_owner(&current.document.id, &current.writer),
            "draft",
            &snapshots::draft_owner(&current.document.id, &writer),
            "draft",
            &current.hash,
        )?;
        tx.execute(
            "UPDATE drafts SET hash=NULL,sequence=? WHERE document=? AND writer=?",
            params![i64::MAX, current.document.id, current.writer],
        )?;
        tx.execute(
            "DELETE FROM presence WHERE document=? AND owner=?",
            params![current.document.id, current.writer],
        )?;
        tx.execute(
            "INSERT INTO drafts VALUES(?,?,?,?,?,?,?)",
            params![
                current.document.id,
                writer,
                current.sequence,
                current.hash,
                current.disk_revision,
                current.paused,
                super::now()
            ],
        )?;
        tx.execute(
            "INSERT INTO presence VALUES(?,?,1)",
            params![current.document.id, writer],
        )?;
        current.writer = writer;
        body.writer = current.writer;
        tx.commit()?;
        Ok(Some(body))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() -> (tempfile::TempDir, Store, Draft) {
        let dir = tempfile::tempdir().unwrap();
        let mut store = Store::open(&dir.path().join("history.db")).unwrap();
        let document = store
            .register("/w/a.md", "/w", Some("/w/a.md"), "a.md")
            .unwrap();
        let draft = Draft {
            document,
            writer: "old:file".into(),
            sequence: 12,
            content: "正文".into(),
            disk_revision: Some("disk-baseline".into()),
            paused: true,
            format: None,
        };
        store.put_draft(&draft).unwrap();
        (dir, store, draft)
    }

    #[test]
    fn index_does_not_read_bodies_and_corrupt_claim_leaves_source_intact() {
        let (_dir, mut store, draft) = setup();
        store
            .conn
            .execute("UPDATE objects SET body=x'FF'", [])
            .unwrap();
        let index = store.recovery_draft_index("/w", "main:").unwrap();
        assert_eq!(index.len(), 1);
        assert!(!serde_json::to_value(&index[0])
            .unwrap()
            .as_object()
            .unwrap()
            .contains_key("content"));
        assert!(store
            .claim_recovery_draft(&index[0], "main:", "claim")
            .unwrap_err()
            .to_string()
            .contains("history_corrupt"));
        assert_eq!(
            store.recovery_draft_index("/w", "other:").unwrap()[0].writer,
            draft.writer
        );
    }

    #[test]
    fn claims_revalidate_presence_across_connections_and_retry_lost_responses() {
        let (dir, mut first, draft) = setup();
        let mut second = Store::open(&dir.path().join("history.db")).unwrap();
        let index = first.recovery_draft_index("/w", "first:").unwrap();
        second
            .presence(&draft.document.id, &draft.writer, true)
            .unwrap();
        assert!(first
            .claim_recovery_draft(&index[0], "first:", "claim")
            .unwrap()
            .is_none());
        second
            .presence(&draft.document.id, &draft.writer, false)
            .unwrap();
        let claimed = first
            .claim_recovery_draft(&index[0], "first:", "claim")
            .unwrap()
            .unwrap();
        assert_eq!(claimed.content, draft.content);
        assert!(second
            .claim_recovery_draft(&index[0], "second:", "claim")
            .unwrap()
            .is_none());
        let retry = first
            .claim_recovery_draft(&index[0], "first:", "claim")
            .unwrap()
            .unwrap();
        assert_eq!(claimed.writer, retry.writer);
        assert_eq!(first.drafts("/w").unwrap().len(), 1);
        assert!(!second
            .put_draft(&Draft {
                sequence: 13,
                content: "late".into(),
                ..draft
            })
            .unwrap());
    }

    #[test]
    fn changed_or_saved_references_are_never_claimed_as_an_older_version() {
        let (_dir, mut store, draft) = setup();
        let index = store.recovery_draft_index("/w", "main:").unwrap();
        store
            .put_draft(&Draft {
                sequence: 13,
                content: "newer".into(),
                ..draft.clone()
            })
            .unwrap();
        assert!(store
            .claim_recovery_draft(&index[0], "main:", "claim")
            .unwrap_err()
            .to_string()
            .contains("history_draft_changed"));
        store
            .finish_draft(&draft.document.id, &draft.writer, 14)
            .unwrap();
        assert!(store
            .claim_recovery_draft(&index[0], "main:", "claim")
            .unwrap()
            .is_none());
    }

    #[test]
    fn index_identity_and_generation_must_still_match_at_claim() {
        let (_dir, mut store, _draft) = setup();
        let index = store.recovery_draft_index("/w", "main:").unwrap();
        store.rebase("/w/a.md", "/w/b.md").unwrap();
        assert!(store
            .claim_recovery_draft(&index[0], "main:", "claim")
            .unwrap_err()
            .to_string()
            .contains("history_invalidated"));
        let current = store.recovery_draft_index("/w", "main:").unwrap();
        store
            .conn
            .execute(
                "UPDATE scopes SET generation=generation+1 WHERE id='/w'",
                [],
            )
            .unwrap();
        assert!(store
            .claim_recovery_draft(&current[0], "main:", "claim")
            .unwrap_err()
            .to_string()
            .contains("history_invalidated"));
    }

    #[test]
    fn closed_window_presence_does_not_hide_its_durable_body() {
        let (_dir, mut store, draft) = setup();
        store
            .presence(&draft.document.id, &draft.writer, true)
            .unwrap();
        store
            .presence(&draft.document.id, "live:file", true)
            .unwrap();
        assert!(store.recovery_draft_index("/w", "new:").unwrap().is_empty());
        store
            .retain_window_presence(&["live:".into(), "new:".into()])
            .unwrap();
        assert!(live(&store.conn, &draft.document.id, "live:file").unwrap());
        let index = store.recovery_draft_index("/w", "new:").unwrap();
        assert_eq!(index.len(), 1);
        assert_eq!(
            store
                .claim_recovery_draft(&index[0], "new:", "claim")
                .unwrap()
                .unwrap()
                .content,
            draft.content
        );
    }

    #[test]
    fn claims_keep_format_pause_and_drafts_when_history_is_disabled_or_cleared() {
        let (_dir, mut store, mut draft) = setup();
        draft.sequence += 1;
        draft.format = Some(TextFileFormat {
            encoding: mf_text_encoding::TextEncoding::Gbk,
            bom: mf_text_encoding::Bom::None,
        });
        store.put_draft(&draft).unwrap();
        store.set_enabled(false).unwrap();
        store.clear(Some("/w")).unwrap();
        let index = store.recovery_draft_index("/w", "main:").unwrap();
        let claimed = store
            .claim_recovery_draft(&index[0], "main:", "claim")
            .unwrap()
            .unwrap();
        assert_eq!(claimed.content, draft.content);
        assert_eq!(claimed.format, draft.format);
        assert_eq!(claimed.disk_revision, draft.disk_revision);
        assert!(claimed.paused);
        assert!(store
            .draft_descriptor(&claimed.document, &claimed.writer)
            .unwrap()
            .is_some());
    }
}
