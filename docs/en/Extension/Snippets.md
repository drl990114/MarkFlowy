---
seoTitle: "Reusable code, math, and Mermaid snippets in MarkFlowy"
description: "Create reusable snippets, preview them, and insert them from the slash menu or a block toolbar in MarkFlowy Desktop."
updatedAt: "2026-09-27"
---

# Snippet library

Save frequently used code, formulas, and diagrams in **Settings → Snippet Library**. Snippets are stored locally and are available across workspaces in the desktop app.

| Type | Built-in example | Source to enter |
| --- | --- | --- |
| Math | A fraction | Formula content without the outer `$$`. |
| Mermaid | A flowchart | Diagram source without a Markdown code fence. |
| Code | JSON | Code without the outer fence; choose its language separately. |

## Create and manage

Search by name, create a snippet, or copy a built-in example. Give it a name, choose its type, and enter the source. Indentation, tabs, and leading or trailing newlines are preserved. Placeholder-like text is inserted literally, rather than expanded as a template.

Changes remain a draft until you choose **Save**. If you leave with unsaved changes, you can save, discard, or cancel. Choose **Preview** to render a read-only example; after editing the source, preview again to refresh it. A preview error does not prevent saving.

You can hide and restore built-in snippets, and duplicate, edit, or delete your own entries.

## Insert into a document

In visual editing, type `/` and highlight **Math**, **Mermaid**, or **Code** to reveal its snippets. Press Enter on the category to insert an empty block. Press Right to enter the submenu, then use Up, Down, and Enter to insert a snippet. Left returns to the category; Escape closes one menu level at a time.

An existing block's **Insert snippet** button inserts at the source cursor or replaces the selected source text. Without a valid position, insertion goes at the end. Existing code blocks keep their language; new blocks use the snippet language. One insertion can be undone in one step.

## Saving and using multiple windows

The library is saved as `snippets.json` in the application data directory and can be reused across workspaces. Saving also updates other windows. If another window has changed the same snippet, your draft is retained and a conflict is shown. Copy any changes you want to keep, discard the draft, and reopen the entry to continue from the latest version.
