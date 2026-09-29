# Native desktop E2E

These tests drive the real React application in Tauri's WKWebView, with real Rust
commands, files, watchers and SQLite history. Test CI runs them as a required step
on macOS after building the workspaces and the isolated native test binary.

The driver is [WebdriverIO's Tauri embedded provider](https://webdriver.io/docs/desktop-testing/tauri/),
pinned to service/plugin 1.4.0. The optional Cargo `e2e` feature enables its local
WebDriver server. Normal development and release builds do not include that server.
The JavaScript mocking plugin is not used.

## Running

Requires Node 24, macOS 14+, Rust/Tauri prerequisites, and the verified private
Capricorn runtime (`yarn install:capricorn-runtime`). Missing prerequisites fail
the run; there is no skipped-test or editor fallback path.

```sh
# Check the suite and runner without compiling or launching the app:
yarn workspace @markflowy/desktop test:e2e:types
yarn workspace @markflowy/desktop test:e2e:runner

# Explicit preparation (CI performs these; test:e2e never builds implicitly):
yarn build
yarn workspace @markflowy/desktop tauri:build:e2e

# All eight scenarios, serially:
yarn workspace @markflowy/desktop test:e2e
# Or a named scenario:
yarn workspace @markflowy/desktop test:e2e atomic-replace
```

`MARKFLOWY_E2E_BINARY` optionally specifies a prebuilt test binary. The default is
the Cargo workspace's `target/debug/markflowy`. An ordinary production binary
cannot satisfy the native test marker/server checks.

## Coverage

| Scenario | Required outcome |
| --- | --- |
| `save-reopen` | UI typing → Cmd+S → exact disk bytes → close → reopen |
| `switch-modes` | Unsaved content survives source, preview and WYSIWYG switching |
| `external-write` | A real in-place external write updates the clean editor |
| `atomic-replace` | Rename replacement reloads and subsequent writes remain watched |
| `dirty-conflict` | Local draft, external disk version and visible conflict all survive |
| `switch-tabs` | Rapid A/B switching preserves content ownership and save targets |
| `history-restore` | UI restoration creates a dirty draft; disk changes only after save |
| `draft-restart` | SQLite draft persists before process exit and recovers in a new process |

The CLI opens fixtures and reads receipts/hashes. Edits, save shortcuts, mode
changes, tab switching and history restoration use WebDriver UI interactions.
Watcher assertions use passive `file status`, never `file wait` (which actively
refreshes the document). The restart scenario uses two separate native launches
with the same isolated profile, and checks that the process ID changed.

## Isolation and diagnostics

Each scenario has a runner-owned temporary root, UUID app identifier and WKWebView
data-store identifier. Configuration, CLI receipts and history live under that
root; Tauri plugin profiles use the unique identifier. The native E2E binary
refuses to start without the matching ownership marker. Automatic update checks
and CLI installation are disabled in this test environment. Default settings
are English, light theme, 1200 × 800 and autosave off.

Scenarios use fresh processes with no retries. Before cleanup the runner saves
fixture files, SQLite/WAL, CLI receipts and profile state to `reports/`, alongside
screenshots, page source, unhandled frontend errors and native/runner logs.
Cleanup only targets the runner's marked root and exact UUID profile paths;
it never changes HOME or uses the normal MarkFlowy profile. CI uploads reports
even on failure and retains them for seven days. Reports contain fixture text
and must not be populated using private documents.

This first suite covers macOS WKWebView with WebDriver-generated input. It does
not establish system IME, native file-picker, visual-regression, Windows/Linux,
performance or packaged-release acceptance. Local type/unit/lint checks likewise
do not prove that the native suite passed; that result must come from Test CI.
