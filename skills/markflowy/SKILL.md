---
name: markflowy
description: Open local Markdown files in MarkFlowy, confirm that requested content is displayed, and export a specific file to a chosen destination using verified CLI receipts. Use when the user wants an AI-created or edited document shown or exported in MarkFlowy.
---

# MarkFlowy

Use the installed `markflowy` CLI for local document handoff. The repository distributes this official skill; it requires CLI protocol 1. Read [the command reference](references/cli.md) for options, receipt fields, and failure handling.

Run `markflowy status` to check `cliProtocolVersion: 1`. If the command is missing or the protocol is older, report that the installed app/CLI needs updating; do not present an OS open command or a GUI dispatch as verified completion. The app installs its CLI wrapper on supported configured paths when launched. Do not modify the user's shell configuration without a request.

Use `markflowy window list` to identify the user's target workspace/window. Preserve an explicitly requested window ID; a missing window is an error. With no running app, `file open` can launch it and return the selected `windowId`. Use that ID for follow-up commands.

Create or edit the user's local file with the available file tools. Prefer UTF-8 without BOM for generated Markdown. Then hand it off:

```sh
markflowy file open "/absolute/path/report.md" --preview --wait applied --window-id main --json
```

Replace example paths and `main` with the actual target. Commands accept relative paths relative to the invoking shell, but absolute paths remove ambiguity. `--wait applied` is the default. It captures the disk content at invocation, refreshes the open document through MarkFlowy's conflict-aware synchronization, and confirms the live editor content after a rendering opportunity. It never overwrites conflicting unsaved edits.

For an exact revision produced earlier, supply its decoded-text SHA-256 with `--sha256`. If the document is already displayed, `file wait` verifies application without changing the selected tab. `file status` provides a read-only snapshot. A successful status query does not mean that the file is open or displayed: inspect `open`, `ready`, `visible`, and `applied`.

For export, name both the source and destination:

```sh
markflowy file export "/absolute/path/report.md" --format html --output "/absolute/path/report.html" --window-id main --json
```

The output directory must exist. Existing outputs are protected; use `--overwrite` only within the user's intended replacement scope. The source file cannot be used as the output. PDF currently uses an interactive print dialog, so the CLI cannot confirm a PDF destination. Explain that limitation instead of claiming an export finished.

Only say the file is displayed when `ok` is true and `result.ready`, `result.visible`, and `result.applied` are true for the intended path/window. Only say an export finished after `code: "export_completed"`; report `result.output.path` and preserve its byte count and SHA-256 as evidence. These receipts confirm content application and file output, not a visual review of every image, font, or diagram.

`command execute` can return `code: "dispatched"` with `completed: false`. This is not evidence that saving, printing, or exporting completed. Prefer the dedicated file commands for those confirmations.

On `content_conflict`, retain the user's unsaved changes and describe the conflict. On timeout, completion is unknown: inspect the file state or destination before retrying; do not blindly repeat a mutation. Do not poll indefinitely or automatically authorize overwrite to turn a failure into success.
