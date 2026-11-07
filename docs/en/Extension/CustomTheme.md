---
seoTitle: 'Custom MarkFlowy themes'
description: 'Create JSON themes and scoped CSS snippets with templates, selector guidance and live previews.'
updatedAt: '2026-11-06'
---

# Custom themes

Themes are JSON data. Creating one requires no Node installation, npm package, or JavaScript build. Open **Settings → Theme Store** and choose **Create theme** or **Copy and edit**.

## Develop with an AI agent

The repository provides [MarkFlowy Dev](https://github.com/drl990114/MarkFlowy/tree/main/skills/markflowy-dev), a developer Skill currently covering custom themes and CSS, with a light/dark starter and guidance for validation, import, and sharing. Copy the entire `skills/markflowy-dev` directory into your agent's skills directory (for example, `~/.agents/skills/markflowy-dev` for Codex).

Example prompt: `Use $markflowy-dev to create a warm paper-style MarkFlowy theme with light and dark variants, and explain how to import and validate it.` The Skill also works without a source checkout through the app's theme editor.

For a local style change, ask for a personal snippet: `Use $markflowy-dev to give completed tasks a strikethrough in MarkFlowy. Deliver a separate CSS snippet and keep my current theme.` The Skill distinguishes overall themes, independent snippets, and CSS that explicitly belongs to a theme variant. Asking how a selector works does not require generating a theme; completing a task or formatting document content is an ordinary document edit.

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

## Personal CSS templates and preview

Open **Settings → Appearance → Typography & CSS → Personal CSS snippets** and create or edit a snippet. **Insert template** appends one of four starters without replacing your draft: completed-task strikethrough, heading separators, compact table cells, or accent quote lines. **Selector reference** opens the element guide.

The live preview shows the draft together with other enabled snippets. Editing a draft changes only the preview; **Save snippet** stores it, and **Enable after saving** controls whether it applies to the application. An imported snippet remains disabled until you enable it. Cancel leaves the saved CSS unchanged. Check the sample's completed, incomplete and nested tasks, headings, quote, code and table before applying a rule to your own document.

### Editor selector reference {#editor-css-selectors}

Prefix document styles with **`.mf-editor-content`**. This public root is shared by the document editor and the theme/CSS preview, keeping these rules away from settings controls. This root is available in the version introducing snippet templates and previews; older app releases may not contain it. CSS is not automatically scoped, so include the prefix in each rule. The examples also use `[data-cap-content]` to target the Capricorn rendering surface inside this root.

The following internal selectors are a reference for **Capricorn 0.5.12**, used by live editing and reading modes when that runtime is installed. Internal classes may change with an editor upgrade. Markdown source mode and PDF/print output use different renderers; these rules do not promise equivalent styling there.

| Element | Selector inside `.mf-editor-content [data-cap-content]` |
| --- | --- |
| Headings | `h1` through `h6` |
| List item | `.capricorn-markdown-list-item` |
| Task item | `.capricorn-markdown-list-item[data-markdown-task]` |
| Task checkbox | `.capricorn-markdown-task-checkbox` |
| List item's text | `.capricorn-markdown-list-content` |
| Simple quote | `blockquote.capricorn-markdown-blockquote` |
| Other blocks inside a quote | `.capricorn-markdown-quoted-block` |
| Table row | `.capricorn-markdown-table-row` |
| Table header row | `.capricorn-markdown-table-row[data-markdown-table-header='true']` |
| Table cell | `.capricorn-markdown-table-cell`, `.capricorn-markdown-inline-table-cell` |
| Code editor inside a code block | `.cm-editor` |

List items and table cells are not necessarily `<li>` or `<td>` elements. Code blocks can contain a CodeMirror editor. Avoid changing their layout or editable behavior. Do not use document indexes, generated node IDs, or virtualization spacers as styling hooks. Virtualized table rows also make `nth-child` unreliable for persistent document row stripes.

### Completed-task strikethrough

```css
.mf-editor-content [data-cap-content] .capricorn-markdown-list-item:has(
  > .capricorn-markdown-task-prefix > .capricorn-markdown-task-checkbox:checked
) > .capricorn-markdown-list-content {
  text-decoration: line-through;
}
```

The direct-child relationships test the item's own checkbox and style its own content. Keep them when adapting the example: broad descendant selectors can include additional content in nested lists. Check both completed parents with incomplete children and incomplete parents with completed children.

### Other starter rules

```css
/* Heading separators */
.mf-editor-content [data-cap-content] :is(h1, h2) {
  border-bottom: 1px solid var(--mf-theme-border-default);
  padding-bottom: 0.3em;
}

/* Compact table cells */
.mf-editor-content [data-cap-content] :is(
  .capricorn-markdown-table-cell,
  .capricorn-markdown-inline-table-cell
) {
  padding: 2px 8px;
}

/* Accent quote lines, preserving nested quote depth */
.mf-editor-content [data-cap-content] :is(
  blockquote.capricorn-markdown-blockquote,
  .capricorn-markdown-quoted-block
) {
  background-image: repeating-linear-gradient(
    to right,
    var(--mf-theme-accent-background) 0,
    var(--mf-theme-accent-background) 2px,
    transparent 2px,
    transparent 1em
  );
}
```

Quote lines are drawn with a background, so changing only `border-color` does not recolor them. The examples use semantic variables to follow the active theme. Previewing a sample does not verify every document structure: check the actual document and intended light/dark modes, especially after editor upgrades.

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
