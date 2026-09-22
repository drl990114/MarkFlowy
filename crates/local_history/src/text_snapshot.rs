//! Metadata belongs to a snapshot reference, not to a deduplicated byte object.
use anyhow::{bail, Result};
use mf_text_encoding::TextFileFormat;
use rusqlite::{params, Connection, OptionalExtension};

pub fn draft_owner(document: &str, writer: &str) -> String {
    serde_json::to_string(&(document, writer)).expect("string tuple")
}

pub fn put(
    conn: &Connection,
    owner: &str,
    slot: &str,
    hash: &str,
    disk: bool,
    format: Option<TextFileFormat>,
) -> Result<()> {
    conn.execute("INSERT INTO text_snapshots VALUES(?,?,?,?,?) ON CONFLICT(owner,slot) DO UPDATE SET hash=excluded.hash,disk=excluded.disk,format=excluded.format",
        params![owner, slot, hash, disk, format.map(|f| serde_json::to_string(&f)).transpose()?])?;
    Ok(())
}

pub fn get(
    conn: &Connection,
    owner: &str,
    slot: &str,
    hash: &str,
) -> Result<Option<(bool, Option<TextFileFormat>)>> {
    let row: Option<(String, bool, Option<String>)> = conn
        .query_row(
            "SELECT hash,disk,format FROM text_snapshots WHERE owner=? AND slot=?",
            params![owner, slot],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()?;
    row.map(|(stored, disk, format)| {
        if stored != hash {
            bail!("history_snapshot_mismatch");
        }
        Ok((disk, format.map(|f| serde_json::from_str(&f)).transpose()?))
    })
    .transpose()
}

pub fn copy(
    conn: &Connection,
    source: &str,
    source_slot: &str,
    target: &str,
    target_slot: &str,
    hash: &str,
) -> Result<()> {
    if let Some((disk, format)) = get(conn, source, source_slot, hash)? {
        put(conn, target, target_slot, hash, disk, format)?;
    } else {
        conn.execute(
            "DELETE FROM text_snapshots WHERE owner=? AND slot=?",
            params![target, target_slot],
        )?;
    }
    Ok(())
}

pub fn read(
    conn: &Connection,
    owner: &str,
    slot: &str,
    hash: &str,
    bytes: Vec<u8>,
    legacy: fn(Vec<u8>) -> Result<String>,
) -> Result<(String, Option<TextFileFormat>)> {
    if super::digest(&bytes) != hash {
        bail!("history_corrupt");
    }
    match get(conn, owner, slot, hash)? {
        Some((false, format)) => Ok((String::from_utf8(bytes)?, format)),
        Some((true, format)) => Ok((
            mf_text_encoding::decode(&bytes, format.map(|f| f.encoding))?.content,
            format,
        )),
        // Existing v1 records did not distinguish UTF-8 drafts from disk bytes.
        // They remain readable, but never acquire an invented writable format.
        None => Ok((legacy(bytes)?, None)),
    }
}
