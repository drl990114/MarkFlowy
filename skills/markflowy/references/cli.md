# CLI protocol 1

The native CLI uses the existing Tauri single-instance transport, a per-request ID, a frontend listener readiness handshake, and an atomic receipt file. The invoking process waits for the receipt; launching a GUI process is not success. No network server is required.

## Commands

| Command | Behavior |
| --- | --- |
| `status` | Runtime discovery with `running`, `cliProtocolVersion`, process, windows, and commands |
| `window list` | Known windows and workspace paths |
| `window focus <id>` | Focus one explicit window |
| `file status <path>` | Query live file state in the selected window; does not open/activate it |
| `file open <path> [--preview]` | Open or activate a file; wait for visible/applied content |
| `file wait <path>` | Wait for an already open file to satisfy the visibility/content condition |
| `file export <path> --format <format> --output <path>` | Open/activate the specified source, render, write, and verify the destination |
| `open <path>` | File open, or workspace switching when the path is a directory |
| `command list` | Discover GUI command IDs |
| `command execute <id>` | Dispatch a GUI command; its asynchronous effects remain unconfirmed |

File/control commands emit one JSON receipt by default. `--json` makes this explicit. Discovery commands retain their existing runtime object/list shapes.

## Options

- `--window-id <id>` / `--window <id>`: exact target; never fall back from a missing explicit window.
- `--wait applied|visible`: defaults to `applied`. `visible` allows the current unsaved content to differ from disk; do not claim an expected revision was applied when `applied` is false.
- `--sha256 <digest>`: expected SHA-256 of decoded text encoded as UTF-8, without BOM and preserving line endings. Without it, the CLI reads a stable disk snapshot at invocation. For generated UTF-8 files without BOM, ordinary SHA-256 of the file bytes is equivalent.
- `--timeout <ms>`: 1–300000 milliseconds, default 30000; includes startup, queueing, rendering, and output.
- `--format html|markdown|text|json|jpg`: HTML and image exports reuse the editor renderers. Text/JSON need the Markdown runtime; open the Markdown preview first when starting from Source Code. Unsupported renderers fail explicitly.
- `--output <path>`: an exact destination in an existing directory.
- `--overwrite`: permits replacing an existing output, but never the source file or its hard-link/symlink aliases.
- `--`: subsequent arguments are literal positional values. Quote paths containing spaces.

`file open` can start the app. Other control commands require a running app. If the existing app is older than the CLI bridge, delivery may time out; update/restart the app before trying again.

## Receipts

Common fields: `protocolVersion`, `requestId`, `ok`, `code`, `message`, `result`.

Exit status: `0` for an `ok` receipt, `1` for operation failure or unknown completion, `2` for invalid arguments. A query or dispatch can succeed without satisfying the intended file completion condition.

File state includes `path`, `windowId`, `fileId`, `open`, `active`, `visible`, `ready`, `mode`, `dirty`, `conflict`, `expectedSha256`, `contentSha256`, and `applied`. An unavailable live reader omits `contentSha256` and leaves `applied` false. Hidden panes and pending IME input cannot provide a visible-content confirmation.

Success codes:

- `file_status`: query completed; inspect the returned state.
- `content_applied`: requested content is applied and visible after a rendering opportunity.
- `file_visible`: current content is visible; requested content may differ.
- `export_completed`: `result.file` identifies the rendered source snapshot; `result.output` contains the verified `path`, `format`, `bytes`, and `sha256`.
- `workspace_opened` / `focused`: workspace/window actions only.
- `dispatched`: a GUI handler returned; `completed: false` makes no claim about asynchronous effects.

Failures include `invalid_arguments`, `app_not_running`, `window_not_found`, `file_unavailable`, `file_unstable`, `file_not_open`, `editor_failed`, `content_conflict`, `content_changed`, `export_failed`, `command_not_found`, `delivery_failed`, and `timeout`. `message` contains the concrete reason. A timeout or failure after a native write may leave an output: inspect it before retrying. Do not treat an existing destination by itself as evidence that this particular export succeeded.

## Implementation references

- [Tauri CLI](https://v2.tauri.app/plugin/cli/): existing argument/launcher integration.
- [Tauri single instance](https://v2.tauri.app/plugin/single-instance/): forwarding requests to the running app.
- [VS Code CLI](https://code.visualstudio.com/docs/configure/command-line): familiar CLI discovery conventions. MarkFlowy's `--wait applied` waits for displayed content; VS Code's `--wait` waits for files to close.
