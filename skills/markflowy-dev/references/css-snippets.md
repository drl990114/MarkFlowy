# CSS snippets

Use a personal `.css` snippet for local presentation that should remain independent of the selected theme. Put CSS in a theme variant only when the user wants it to follow that variant or be included in a shared theme. Ordinary Markdown content edits do not require CSS. For explanation or troubleshooting requests, diagnose the supplied rule before producing or replacing files.

## Scope and compatibility

The public `.mf-editor-content` root is shared by the Capricorn document host and the theme/CSS preview. Prefix document rules with this root and `[data-cap-content]` for the runtime surface inside it so they do not style the settings controls or the CSS editor itself. The public root is available in the version that introduces CSS templates and snippet previews; for older installed versions, verify the available root before claiming compatibility.

The internal selectors below were checked against Capricorn runtime **0.5.12**. They target its live-editing and reading surfaces, not the Markdown source editor or the separate PDF/print renderer. Internal classes are a versioned reference, not a promise that every internal DOM node will remain unchanged. Do not depend on node IDs, document indexes, virtualization spacers, caret overlays, or layout wrappers for presentation.

| Element | Selector within `.mf-editor-content [data-cap-content]` |
| --- | --- |
| Heading | `h1`, `h2`, `h3`, `h4`, `h5`, `h6` |
| List item | `.capricorn-markdown-list-item` |
| Task item | `.capricorn-markdown-list-item[data-markdown-task]` |
| Task checkbox | `.capricorn-markdown-task-checkbox` |
| List item's text | `.capricorn-markdown-list-content` |
| Simple blockquote | `blockquote.capricorn-markdown-blockquote` |
| Other blocks inside a quote | `.capricorn-markdown-quoted-block` |
| Table row | `.capricorn-markdown-table-row` |
| Header row | `.capricorn-markdown-table-row[data-markdown-table-header='true']` |
| Table cell | `.capricorn-markdown-table-cell`, `.capricorn-markdown-inline-table-cell` |
| Code editor inside a code block | `.cm-editor` |

Do not assume list items are HTML `<li>` elements or table cells are `<td>` elements. A code block can contain a CodeMirror editor rather than only `<pre><code>`. Avoid replacing these components' layout, positioning, overflow, or content-editable behavior. A table can virtualize rows, so `nth-child` does not guarantee persistent document row parity.

Semantic variables such as `var(--mf-theme-border-default)` and `var(--mf-theme-accent-background)` follow the active theme. Prefer them over hard-coded palette colors. Read the theme reference only if the task also needs token changes.

## Completed-task strikethrough

This rule checks the task's own checkbox and styles only its own content:

```css
.mf-editor-content [data-cap-content] .capricorn-markdown-list-item:has(
  > .capricorn-markdown-task-prefix > .capricorn-markdown-task-checkbox:checked
) > .capricorn-markdown-list-content {
  text-decoration: line-through;
}
```

Keep the direct-child combinators. A broad `:has(...:checked)` or descendant `.capricorn-markdown-list-content *` can select additional content when lists are nested. Do not change Markdown task state to achieve a visual effect.

## Heading separators

```css
.mf-editor-content [data-cap-content] :is(h1, h2) {
  border-bottom: 1px solid var(--mf-theme-border-default);
  padding-bottom: 0.3em;
}
```

## Compact table cells

```css
.mf-editor-content [data-cap-content] :is(
  .capricorn-markdown-table-cell,
  .capricorn-markdown-inline-table-cell
) {
  padding: 2px 8px;
}
```

## Accent quote lines

Quote lines use a repeating background rather than a border, including nested quote depths. Keep that geometry and replace only the color:

```css
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

## Preview, import, and deliver

1. Open **Settings → Appearance → Typography & CSS → Personal CSS snippets**. Create or edit a snippet, then use **Insert template** or **Selector reference** as needed. Inserting a template appends CSS; keep the user's existing rules unless replacement was requested.
2. Edit the CSS and inspect the live preview. A draft affects the preview before saving; it does not replace the application's saved snippets. Check completed and incomplete tasks, including mixed nested states, or the elements targeted by the rule.
3. **Save snippet** when the result is intended for use; **Enable after saving** controls whether it is applied. Imported `.css` files start disabled and must be enabled separately. Respect each existing snippet's enable state; producing a file does not require changing the active theme or personal appearance preferences.
4. Check the actual document in the intended mode and both light/dark themes when relevant. Preview and application use the same CSS root, but a preview sample does not exercise every document structure. Source and PDF/print output require separate rules and validation if requested.

Deliver only the intended `.css` file, its target mode/version, and import/enable instructions. Do not edit `themes-v1.json` directly or execute legacy JS themes. CSS is not automatically selector-scoped: include the root in the rules themselves. Report syntax/selector checks separately from visual inspection; if the app is unavailable, leave the visual checks above explicitly pending.

For a checkout, inspect `apps/desktop/src/themes/editorCssScope.ts`, `apps/desktop/src/themes/cssSnippetTemplates.ts`, and the installed runtime when confirming a selector. No repository clone, Node installation, private runtime installation, or build is required merely to author and import a snippet.
