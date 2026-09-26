---
seoTitle: 'Custom MarkFlowy themes'
description: 'Create, edit and share declarative JSON themes with the visual theme editor.'
---

# Custom themes

Themes are JSON data. Creating one requires no Node installation, npm package, or JavaScript build. Open **Settings → Theme Store** and choose **Create theme** or **Copy and edit**.

## Visual editor

The preview contains application controls and a real Capricorn editor. Enable the inspector, or right-click the preview, to locate the relevant token. Search tokens, show modified values, edit alpha colors and typography, or link tokens of the same type. Reset removes an override; invalid values and circular references report errors. Each color-picker drag is one undo step.

The advanced section edits JSON and theme CSS. Each theme has its own draft in the current window, including the selected variant and unapplied JSON. Apply or discard JSON edits before continuing visual editing or exporting. **Save and apply** updates the library and other windows. Drafts can be resumed or discarded. Editing a built-in theme creates a personal copy. The interactive preview runs in its own iframe document, including its editor input and popovers.

The preview shows the theme itself. Personal accent preferences take precedence when applying it. Turn off “Use personal fonts, size and line height” on the theme page to use the theme's typography; your personal values remain saved. Set the accent preference to follow the theme in appearance settings.

## Format

```json
{
  "version": 1,
  "id": "my-theme",
  "name": "My Theme",
  "author": "Your name",
  "variants": [
    {
      "id": "light",
      "name": "My Theme Light",
      "mode": "light",
      "tokens": {
        "surface.canvas": "#fffdf6",
        "surface.panel": "#f2eee3",
        "text.primary": "#34312a",
        "text.secondary": "#746e62",
        "border.default": "#d9d2c3",
        "accent.background": "#526f52",
        "editor.link": { "ref": "accent.background" }
      },
      "css": ""
    }
  ]
}
```

IDs are stable identities of 1–80 characters using lowercase letters, digits, dots, underscores and hyphens, starting with a letter or digit. Display names can change. A document may contain several light and dark variants. Missing tokens use mode defaults. Download the complete [Paper example](../../themes/paper.json), or export the current JSON Schema from the theme page.

Token groups describe their purpose: `surface`, `text`, `accent`, `focus`, `interaction`, `status`, `chrome`, `editor`, `syntax`, `font`, `radius`, and `scrollbar`. Hover, pressed, selected and focus are separate values. Color literals use CSS formats supported by Color and resolve to RGBA hex. Lengths support zero or non-negative `px`, `rem`, `em`, `ch` and `%`; line height is a positive decimal number. Fonts accept CSS family lists, such as `"Open Sans", sans-serif`. Use CSS for expressions beyond these typed values.

Unless overridden, `accent.subtle` and `accent.foreground` derive from `accent.background`. References follow these derived values; circular references are rejected even when a cycle passes through a derived default.

## CSS and persistence

Theme CSS switches with its variant. Personal CSS snippets are independent: import, edit, enable, disable and reorder them, or disable all to recover from a bad customization. Imported snippets start disabled. Enabled snippets load as separate stylesheets after theme CSS in list order, so a parse error in one snippet does not consume the next. Normal specificity and `!important` still apply. Theme exports exclude personal snippets.

The library is stored as `themes-v1.json` in the application data directory and written atomically. Legacy JS themes and automatically loaded CSS are neither executed nor migrated; original files are retained. Missing or invalid selections temporarily fall back to a built-in theme while retaining the selected identity; repairing the theme restores it. Explicit deletion resets matching selections.

Semantic CSS variables use `--mf-theme-` followed by the token name in kebab case, for example `--mf-theme-surface-canvas` or `--mf-theme-font-editor-line-height`. Desktop controls and the Capricorn document adapter consume these variables. CSS overrides affect their consumers; they do not rewrite JSON references or RME's resolved JavaScript palette. Set tokens in JSON when a change should apply across all renderers. Existing `--mf-*` facade aliases are internal: `--mf-accent` means a control hover surface, distinct from the public `accent.background` role.

## Capricorn 0.3.0 theme contract

MarkFlowy integrates `@drl990114/capricorn-runtime@0.3.1`, retaining the theme contract introduced in 0.3.0. The exact version is pinned in `scripts/install-capricorn-runtime.mjs` and `apps/desktop/capricornRuntimeResolver.ts`. The installer verifies the published tarball's SHA-256 and package identity. Release provenance and validation are recorded in [Startup performance](../../STARTUP_PERFORMANCE.md#capricorn-031-release-integration-2026-09-26).

Capricorn owns its `--cap-*` defaults. It no longer reads `--mf-*` or `--rme-*` fallback variables. MarkFlowy supplies an explicit map from resolved semantic tokens to each editor instance, including its popup surfaces. Theme authors normally edit the JSON tokens; hosts embedding Capricorn directly must supply the corresponding Capricorn variables themselves.

| MarkFlowy semantic token | Capricorn instance style |
| --- | --- |
| `editor.background`, `editor.foreground` | `--cap-surface`, `--cap-text` |
| `editor.caret`, `editor.link` | `--cap-caret`, `--cap-link` |
| `accent.background`, `accent.foreground`, `accent.subtle` | `--cap-accent`, `--cap-accent-foreground`, `--cap-accent-soft` |
| `editor.selection.background`, `editor.selection.foreground` | `--cap-selection`, `--cap-selection-foreground` |
| `editor.selection.inactiveBackground` | `--cap-inactive-selection` |
| `editor.code.background`, `editor.code.foreground` | `--cap-code-background`, `--cap-code-color` |
| `syntax.keyword`, `syntax.string`, `syntax.function` | `--cap-code-token-keyword`, `--cap-code-token-string`, `--cap-code-token-title` |
| `status.success.foreground`, `status.danger.foreground` | `--cap-code-token-inserted`, `--cap-code-token-deleted` |
| `font.ui.family`, `font.code.family` | `--cap-font-ui`, `--cap-font-mono` and `--cap-code-font-family` |
| `font.editor.family` | `style.fontFamily` |
| `font.editor.size`, `font.editor.lineHeight` | `--cap-editor-font-size`, `--cap-editor-line-height` |
| `editor.contentWidth` | `--cap-editor-content-width`; Desktop's full-width preference can override it |

The runtime exports `CapricornThemeVariable` and `CapricornThemeStyle`. Both creation options and `runtime.updateSettings({ style, colorScheme })` accept these styles. Pass the complete next style map: an update replaces the previous style object. It updates the existing instance without resetting its document. Set `colorScheme` explicitly when the host selects a light or dark variant.

Code highlighting uses stable `.cap-syntax-*` classes, such as `.cap-syntax-keyword` and `.cap-syntax-title`, backed by `--cap-code-token-*`. Here, `variable` means variable identifiers; `attribute` covers attributes, ordinary properties, class names and namespaces; `title` means function and method names (`syntax.function` in MarkFlowy). Diff line backgrounds derive a 10% tint from `--cap-code-token-inserted` or `--cap-code-token-deleted`, so they follow the host's semantic status colors. Prefer these variables and stable `data-cap-*`/`data-slot` attributes over generated CodeMirror classes. A document editor follows the application's semantic CSS variables. The isolated preview defines its own semantic variables on the iframe document root and maps them to Capricorn within that document; personal snippets are included only when explicitly enabled in the preview.

## Migrating older themes

This is a breaking theme format and host contract; there is no compatibility loader.

1. Convert JS/npm theme registration to one JSON document with stable theme and variant IDs. Replace old styled-token names with semantic roles, then import and validate the JSON in Theme Store.
2. Move variant-specific CSS into that variant's `css`. Import personal CSS as separate snippets and enable them individually after review. Original legacy files remain on disk but are not loaded automatically.
3. Replace dependencies on internal `--mf-*`/`--rme-*` aliases or generated classes. Use JSON semantic tokens for MarkFlowy themes, or explicit `--cap-*` instance styles for a standalone Capricorn host. Check both light and dark variants, selection text, caret, links, code colors and popup surfaces.

Theme JSON remains schema `version: 1`; this number describes the document format and is independent of the Capricorn runtime version.

## Distribution

Export and host the JSON at a public HTTPS URL. Submit an entry to the root `community-themes.json`:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "author": "Your name",
  "version": "1.0.0",
  "url": "https://example.com/my-theme.json"
}
```

The downloaded document's ID must match the catalog. Existing IDs offer replacement or a separate copy. Legacy npm themes must be converted by their authors before resubmission.
