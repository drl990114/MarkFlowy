---
name: markflowy-dev
description: Create, adapt, or troubleshoot MarkFlowy JSON themes and custom CSS. Use for semantic theme tokens, theme CSS, personal CSS snippets, and legacy theme migration. Not for ordinary document editing, task completion, Markdown formatting, or export.
---

# MarkFlowy Dev

Help developers produce usable MarkFlowy customizations. Custom themes and CSS are the currently documented capabilities; keep future extension guidance in separate references when those capabilities exist. Do not assume MarkFlowy has an executable plugin API.

## Establish the target

Distinguish content changes from appearance changes: “mark this task complete” or “strike out this sentence” changes the document; “show completed tasks with a strikethrough” changes presentation. Ordinary content changes do not need this skill. A request to explain a selector or diagnose CSS calls for an explanation or diagnosis, not an unsolicited theme or file rewrite.

Choose the smallest artifact that matches the user's intent:

| Intent | Route |
| --- | --- |
| Local presentation, such as completed-task strikethrough or heading separators, across themes | A separate personal `.css` snippet; read [CSS snippets](references/css-snippets.md) |
| An overall palette, typography, or a complete theme | JSON semantic tokens; read [theme development](references/themes.md) |
| CSS explicitly intended to switch with a theme variant or travel with a shared theme | That variant's `css`; read the theme reference and the relevant CSS guidance |
| Explain a token/selector or troubleshoot an existing customization | Read only the relevant reference and preserve the user's existing artifact type |

Do not turn a small CSS request into a new theme or embed personal snippets in a theme merely because both use this skill. If the user explicitly chooses an artifact type, preserve it; ask only when a missing choice materially affects the result. Use the requested palette, mode, typography, existing customization, and output location. Reply in the user's language.

Identify whether this is a standalone theme project or work inside a MarkFlowy checkout. Theme authors need only JSON and the installed application; do not require Node, a repository clone, a private Capricorn runtime, or a build. In a checkout, inspect its `AGENTS.md`, relevant source, and package versions before changing implementation code. All source paths in the reference are relative to that checkout, not the installed skill directory.

## Develop a customization

- For theme creation or migration, start from the user's theme, an export from their installed version, or [the bundled light/dark starter](assets/theme-starter.json). Copy the starter to the requested output location; give a new theme a suitable ID and name. Keep existing IDs when updating an existing theme. Do not copy the starter for a CSS-only request.
- Prefer JSON semantic tokens for colors and typography. They reach application controls and editor adapters consistently. CSS is useful for localized styling but depends on rendered selectors and can affect unrelated surfaces. Explain that tradeoff when choosing CSS.
- Use existing supported tokens and references before proposing new dependencies or core changes. Do not transplant another editor's theme schema, internal renderer variables, or executable theme code.
- Validate the exact output, then provide the file, import steps, and what remains unverified. Prepare catalog metadata only when sharing is requested; preparing a theme does not authorize publishing or submitting it.

For a development request beyond the documented capabilities, inspect the relevant current public API or repository implementation first. Explain unsupported extension points rather than inventing them; do not load the theme reference for unrelated work.

## Deliver the result

For a theme, deliver a standalone JSON document containing only the intended variants and overrides. If the user requested a personal CSS snippet, deliver a separate `.css` file and explain that it must be enabled after import. Do not write directly to the application's `themes-v1.json` store.

Report validation precisely: JSON parsing, MarkFlowy's semantic validation, CSS selector checks, and visual inspection are separate checks. A schema or source check does not prove CSS rendering, contrast, native editor behavior, or compatibility with a different installed version. If the app is unavailable, provide the relevant reference's preview checklist without claiming it passed.
