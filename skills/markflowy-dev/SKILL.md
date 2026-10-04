---
name: markflowy-dev
description: Create, adapt, validate, and prepare MarkFlowy customizations for sharing. Use for custom JSON themes, semantic theme tokens, theme CSS, personal CSS snippets, and migrating legacy JS/npm themes. Not for editing or exporting ordinary documents in MarkFlowy.
---

# MarkFlowy Dev

Help developers produce usable MarkFlowy customizations. Custom themes and CSS are the currently documented capabilities; keep future extension guidance in separate references when those capabilities exist. Do not assume MarkFlowy has an executable plugin API.

## Establish the target

Use the user's requested palette, mode, typography, existing theme, and output location. Ask only for missing choices that materially affect the result; otherwise choose a sensible starting point and state it. Reply in the user's language.

Identify whether this is a standalone theme project or work inside a MarkFlowy checkout. Theme authors need only JSON and the installed application; do not require Node, a repository clone, a private Capricorn runtime, or a build. In a checkout, inspect its `AGENTS.md`, relevant source, and package versions before changing implementation code. All source paths in the reference are relative to that checkout, not the installed skill directory.

## Develop a customization

For themes, token questions, CSS snippets, or legacy migration, read [the theme development reference](references/themes.md). It includes the current format, validation routes, import workflow, and common preview mismatches.

- Start from the user's theme, an export from their installed version, or [the bundled light/dark starter](assets/theme-starter.json). Copy the starter to the requested output location; give the new theme a suitable ID and name. Keep existing IDs when updating an existing theme.
- Prefer JSON semantic tokens for colors and typography. They reach application controls and editor adapters consistently. CSS is useful for localized styling but depends on rendered selectors and can affect unrelated surfaces. Explain that tradeoff when choosing CSS.
- Use existing supported tokens and references before proposing new dependencies or core changes. Do not transplant another editor's theme schema, internal renderer variables, or executable theme code.
- Validate the exact output, then provide the file, import steps, and what remains unverified. Prepare catalog metadata only when sharing is requested; preparing a theme does not authorize publishing or submitting it.

For a development request beyond the documented capabilities, inspect the relevant current public API or repository implementation first. Explain unsupported extension points rather than inventing them; do not load the theme reference for unrelated work.

## Deliver the result

For a theme, deliver a standalone JSON document containing only the intended variants and overrides. If the user requested a personal CSS snippet, deliver a separate `.css` file and explain that it must be enabled after import. Do not write directly to the application's `themes-v1.json` store.

Report validation precisely: JSON parsing, MarkFlowy's semantic validation, and visual inspection are separate checks. A schema or source check does not prove CSS rendering, contrast, native editor behavior, or compatibility with a different installed version. If the app is unavailable, provide the short preview checklist from the reference without claiming it passed.
