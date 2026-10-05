# Local history

Desktop stores history in `app_local_data_dir/local-history/history.sqlite3`.
The Rust host owns one SQLite worker with a bounded mailbox. WAL and `synchronous=FULL`
make acknowledged snapshots durable; objects are addressed by SHA-256 and verified on read.
History stays outside the user's workspace and works without Git or a network connection.

## Drafts and saves

Draft protection is independent of file autosave and the history setting. The host editor
supplies its latest snapshot after 1 second of idle time, with a 5 second maximum wait
during continuous input. Each document has one running capture and one pending replacement;
an old completion cannot acknowledge a newer edit. Flushes process at most four documents
at a time. An abrupt process termination can lose edits that have not yet been acknowledged.

Writer sequences and tombstones prevent old submissions from reviving saved drafts.
Recovery claims drafts transactionally so another window cannot claim the same draft.
Reload/normal-exit recovery remains available, and its newer snapshot replaces an untouched
background recovery. A conflicting or missing-file draft is preserved as an independent document.

Before an application file write, the worker commits the old bytes and intended new bytes.
The filesystem revision is checked again before writing. A rejected comparison cancels the
prepared operation. Existing files retain the current in-place write semantics for hard links
and symlinks; this does not lock out unrelated external processes. On restart, a journal entry
is completed only if the exact target is already on disk. Otherwise both sides become paused
recovery drafts, with no automatic filesystem replay.

## Grouping external and AI edits

The watcher coalesces notifications per path, keeps one running inspection and one pending
inspection, and retries transient reads at a bounded rate. Open independent documents use
parent-directory watches so atomic replacements remain observable.

An external batch has one immutable original and one replaceable latest result. Time gaps
and application restarts do not split the batch. Local input, an explicit save, or restoration
ends it. A CLI `history begin` protects the initial text; all edits then share that session,
and one `history commit` records the final text. Delayed matching notifications do not create
another version after commit. Idempotent requests with conflicting arguments fail explicitly.
See the [MarkFlowy skill](../../skills/markflowy/SKILL.md) for the AI workflow and CLI reference.

Ordinary local checkpoints are limited to once per minute. Autosaves within a 30 second
window share a record. Identical content is reused only when doing so preserves the displaced
content. Ordinary history expires after 30 days or 100 versions per document; active batches
and drafts are retained, and safety versions have a 7 day minimum. The 1 GB target limits
ordinary checkpoints and new AI sessions; draft protection and safety copies can exceed it.

## Viewing, restoration, and deletion

Settings → Local history provides the default-on switch, the workspace history browser,
and confirmed deletion for the current workspace or all workspaces (including independent
documents). Metadata is paged in groups of 50; version bodies load on selection. CodeMirror
MergeView handles comparison; large comparisons run in a Worker with a bounded fallback.

Restoration first commits the displaced content and the restored draft in one transaction.
It then updates the editor and pauses autosave until a manual save. Turning history off
stops new versions, while draft protection, viewing, restoration, and deletion remain available.

Deletion advances scope generations and invalidates sessions and saved receipts. It preserves
files, drafts, and unresolved write protection. Old requests cannot commit into the cleared
generation. Unreferenced objects are collected and incremental vacuum reclaims database pages.

## Validation

- `cargo test -p mf_local_history -p markflowy --lib`
- `yarn workspace @markflowy/desktop test`
- `yarn workspace @markflowy/desktop build:types` (TypeScript only)
- Changed-file ESLint, `yarn translate:check`, and skill validation

These checks cover state transitions, concurrency admission, journal recovery, coalescing,
restoration, settings, CLI receipts, and read-only comparison. Real Tauri process termination,
OS watcher delivery, and cross-platform latency still require application-level verification.
