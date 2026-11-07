# #1025 body heading numbering acceptance

Tested on 2026-11-07 in macOS 26.5.2 native Tauri DEV at `localhost:3000`.
The ordinary DEV runtime was the installed Capricorn 0.5.13 package.
Used only an owned temporary Markdown document with five headings at levels 1–3,
body paragraphs, and a paragraph reserved for conversion into a new heading.

## Entry points and persistence

| Check | Observed result |
| --- | --- |
| Command palette while the outline is hidden | Searching `numbering` exposes `切换正文标题编号` and adds numbering to all headings |
| Undo and redo manual numbering | One undo removes the prefixes; one redo restores them |
| Outline button | Labels change between `添加正文标题编号` and `移除正文标题编号`; each action updates the document and outline |
| Source mode | The command is disabled with `仅支持所见即所得模式` |
| Preview mode | Numbered headings render correctly; the command is disabled with `预览模式不可编辑` |
| Save, close and reopen | Numbering is present in the saved Markdown and reopened preview |
| Application-native PDF, A4 portrait, heading bookmarks enabled | Export completes and the rendered page retains all five heading prefixes and body paragraphs |

The tooltip explicitly says that numbering is written into Markdown. It is a
document operation, not an outline-only display option or a global setting.
No automatic numbering behavior was added to source mode.

The PDF was rendered with Poppler and visually inspected. Temporary evidence:

- `/tmp/markflowy-issue1025-closeout/numbering-acceptance.md`
- `/tmp/markflowy-issue1025-closeout/numbering-native.pdf`
- PDF SHA-256: `e1521fbce9fb8a3fb9b343029c075c38ceeb5ffcefa388d5cbc7125ac57774e8`
- `/tmp/markflowy-issue1025-closeout/numbering-native.png`

## Defects found during acceptance

- The lazily loaded command palette could subscribe to a captured editor after
  that editor had been destroyed. The host now checks the pane's current runtime
  identity before subscribing. Regression tests cover removal, replacement,
  cleanup and split-pane identity.
- Capricorn 0.5.13 records automatic renumbering separately from the triggering
  edit. Converting a paragraph to H2 updates later numbers, but one undo only
  removes the automatic prefix update and leaves the new heading in place.
  This was reproduced in native DEV and requires an engine change; the host
  does not manipulate private history state.

The engine correction was made in the sibling Capricorn source repository.
It also replaces a previously recognized prefix when a heading changes level,
and preserves the original edit's undo selection. A temporary DEV-only Vite
configuration loaded that source directly without building or editing the
installed package. In native DEV, paragraph-to-H2 conversion and its automatic
renumbering undo and redo together; changing Beta between H2 and H3 replaces
the old prefix instead of duplicating it.

This source verification is limited to the numbering fixture. It is not a
general acceptance of the temporary source-runtime configuration. Ordinary DEV
was restored to the installed 0.5.13 package afterward; the engine correction
requires a future package release and consumer update before ordinary DEV and
distributed applications receive it. No package was published in this task.
The fixture was restored byte-for-byte to its original content, its tab closed,
and the user's active document and Chat AI side panel restored.

## Automated coverage

Host tests cover document-wide numbering without a selection, add/remove state,
tooltip copy, no headings, read-only documents, non-Markdown files, source and
preview modes, stale editor/pane targets and subscription lifecycle.
Desktop TypeScript, changed-file ESLint and locale consistency checks passed.
No production build was run. This report does not claim packaged-release,
Windows or Linux acceptance.

Passed with Node 24:

```sh
yarn workspace @markflowy/desktop test src/components/TableOfContent/HeadingNumberingButton.test.tsx src/extensions/command-palette/editorCommands.test.ts src/extensions/command-palette/CommandPaletteDialog.test.tsx src/extensions/command-palette/commandPaletteSearch.test.ts src/extensions/command-palette/dockCommands.test.ts
yarn workspace @markflowy/desktop test src/extensions/command-palette/usePaletteUpdates.test.tsx
yarn workspace @markflowy/desktop build:types
yarn translate:check
```

The two test runs covered 50 and 4 cases. Changed `.ts` and `.tsx` files were
linted with the repository's installed ESLint 8 runner, without `--fix`.
