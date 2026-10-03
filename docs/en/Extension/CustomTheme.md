---
seoTitle: 'Custom MarkFlowy themes'
description: 'Create, edit and share declarative JSON themes with the visual theme editor.'
updatedAt: "2026-09-27"
---

# Custom themes

Themes are JSON data. Creating one requires no Node installation, npm package, or JavaScript build. Open **Settings → Theme Store** and choose **Create theme** or **Copy and edit**.

## Visual editor

The preview contains application controls and an editor. Enable the inspector, or right-click the preview, to locate the relevant token. Search tokens, show modified values, edit alpha colors and typography, or link tokens of the same type. Reset removes an override; invalid values and circular references report errors. Each color-picker drag is one undo step.

The advanced section edits JSON and theme CSS. Each theme has its own draft in the current window, including the selected variant and unapplied JSON. Apply or discard JSON edits before continuing visual editing or exporting. **Save and apply** updates the library and other windows. Drafts can be resumed or discarded. Editing a built-in theme creates a personal copy.

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

IDs are stable identities of 1–80 characters using lowercase letters, digits, dots, underscores and hyphens, starting with a letter or digit. Display names can change. A document may contain several light and dark variants. Missing tokens use mode defaults. Export a built-in theme for a complete JSON example, or export the current JSON Schema from the theme page.

Token groups describe their purpose: `surface`, `text`, `accent`, `focus`, `interaction`, `status`, `chrome`, `editor`, `syntax`, `font`, `radius`, and `scrollbar`. Hover, pressed, selected and focus are separate values. Color literals use CSS formats supported by Color and resolve to RGBA hex. Lengths support zero or non-negative `px`, `rem`, `em`, `ch` and `%`; line height is a positive decimal number. Fonts accept CSS family lists, such as `"Open Sans", sans-serif`. Use CSS for expressions beyond these typed values.

Unless overridden, `accent.subtle` and `accent.foreground` derive from `accent.background`. References follow these derived values; circular references are rejected even when a cycle passes through a derived default.

## CSS and persistence

Theme CSS switches with its variant. Personal CSS snippets are independent: import, edit, enable, disable and reorder them, or disable all to recover from a bad customization. Imported snippets start disabled. Enabled snippets load as separate stylesheets after theme CSS in list order, so a parse error in one snippet does not consume the next. Normal specificity and `!important` still apply. Theme exports exclude personal snippets.

The theme library and CSS snippets are stored as `themes-v1.json` in the application data directory. Legacy JS themes and automatically loaded CSS are neither executed nor migrated; original files are retained. Missing or invalid selections temporarily fall back to a built-in theme while retaining the selected identity; repairing the theme restores it. Explicit deletion resets matching selections.

Semantic CSS variables use `--mf-theme-` followed by the token name in kebab case, for example `--mf-theme-surface-canvas` or `--mf-theme-font-editor-line-height`. Use JSON tokens to set colors and typography consistently across the application and editor, then add CSS for specific customizations.

## Migrating older themes

Convert legacy JS/npm themes to JSON before importing them.

1. Convert JS/npm theme registration to one JSON document with stable theme and variant IDs. Replace old styled-token names with semantic roles, then import and validate the JSON in Theme Store.
2. Move variant-specific CSS into that variant's `css`. Import personal CSS as separate snippets and enable them individually after review. Original legacy files remain on disk but are not loaded automatically.
3. Set colors and typography with JSON semantic tokens instead of old internal style names. Check both light and dark variants, selection text, caret, links, code colors and popup surfaces.

Set the theme file's `version` to `1`.

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
