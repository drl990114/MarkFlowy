# Theme development

## Choose a compatible starting point

MarkFlowy themes are declarative JSON documents, optionally containing CSS per variant. Prefer an export and JSON Schema from the developer's installed **Settings → Theme Store** when available. The bundled starter targets document format `version: 1`; it is a starting palette, not proof of compatibility with every app release.

With a MarkFlowy checkout, consult these sources as needed:

| Question | Source relative to the checkout root |
| --- | --- |
| Supported tokens, kinds, defaults, and references | `packages/theme/src/semantic/registry.ts` |
| Parser, resolver, exported JSON Schema, CSS variable names | `packages/theme/src/semantic/index.ts` |
| UI/editor adapters | `apps/desktop/src/themes/runtime.ts` |
| Personal accent and typography overrides | `apps/desktop/src/AppThemeProvider.tsx`, `apps/desktop/src/themes/preferences.ts` |
| Theme and snippet state | `apps/desktop/src/themes/library.ts` |
| Import, duplicate IDs, catalog checks, editor UI | `apps/desktop/src/router/Setting/ThemeStore/` |
| Author documentation | `docs/en/Extension/CustomTheme.md`, `docs/zh/Extension/CustomTheme.md` |

Use the installed version's export or the target checkout's parser as the authority if it differs from this guide. No checkout is needed for the application workflow below.

## JSON contract

- A document requires numeric `version: 1`, `id`, nonblank `name`, and 1–32 `variants`. `author` is optional text.
- Each variant requires `id`, nonblank `name`, and `mode: "light"` or `"dark"`. Variant IDs must be unique within the document. Both document and variant IDs match `^[a-z0-9][a-z0-9._-]{0,79}$`.
- `tokens` is an optional object of overrides; omitted tokens use the selected mode's defaults. `css` is optional text. A single-mode theme is valid; keep only the modes the user wants.
- A token value is a **string** literal or exactly `{ "ref": "another.token" }`. References must name an existing token of the same kind. Unknown tokens, invalid literals, and reference cycles are rejected.
- Colors must be understood by the project's `color` parser. Hex, RGB, and HSL are useful portable inputs; do not assume every modern CSS color syntax is accepted. Valid colors resolve to alpha-inclusive hex. CSS expressions such as `var(...)` are not token literals.
- Lengths accept `"0"` or nonnegative `px`, `rem`, `em`, `ch`, `%` strings. Number tokens such as line height use positive numeric **strings**, e.g. `"1.7"`. Font tokens take CSS font-family lists, e.g. `"\"Open Sans\", sans-serif"`; declaring a font does not install it.
- Unoverridden `accent.foreground` and `accent.subtle` derive from `accent.background`. References to derived defaults remain live and participate in cycle detection. For example, linking `accent.background` back to `accent.subtle` is a cycle.

Useful token groups, without duplicating the full registry:

| Intent | Examples |
| --- | --- |
| Main surfaces and text | `surface.canvas`, `surface.panel`, `surface.overlay`, `text.primary`, `text.secondary`, `border.default` |
| Accent and interaction | `accent.background`, `accent.foreground`, `accent.subtle`, `focus.ring`, `interaction.hover`, `interaction.selected` |
| App chrome | `chrome.sidebar.background`, `chrome.titlebar.background`, `chrome.tab.activeBackground` |
| Editor and selection | `editor.background`, `editor.foreground`, `editor.caret`, `editor.selection.background`, `editor.selection.foreground`, `editor.link` |
| Code and status | `editor.code.background`, `syntax.comment`, `syntax.keyword`, `syntax.string`, `status.danger.foreground` |
| Typography and geometry | `font.ui.family`, `font.editor.family`, `font.code.family`, `font.editor.size`, `font.editor.lineHeight`, `font.source.size`, `font.source.lineHeight`, `editor.contentWidth`, `radius.control` |

Choose palette roles together: canvas/text, overlay/text, accent/foreground, selection/selected text, and code/syntax. The selection foreground defaults to the accent foreground; changing only `editor.selection.background` does **not** derive a new matching selection foreground. Inspect both explicitly, including alpha backgrounds. Source and document font sizes/line heights are separate; retain that distinction.

## CSS and snippets

Use tokens first. Semantic CSS variables are `--mf-theme-` plus the token name with dots and camel case converted to kebab case: `surface.canvas` becomes `--mf-theme-surface-canvas`, and `font.editor.lineHeight` becomes `--mf-theme-font-editor-line-height`.

Variant `css` follows the active theme. Personal CSS snippets are independent `.css` files: they start disabled on import, can be enabled/reordered separately, and are excluded from theme exports. Enabled snippets are separate stylesheets after theme CSS in list order; specificity and `!important` still apply.

Theme CSS is not automatically selector-scoped or sanitized by the semantic parser; that parser only checks that `css` is text. Inspect the actual target surface before selecting elements, keep overrides local, and avoid blanket `body`, `button`, `*`, or internal `--cap-*` overrides as a palette mechanism. Do not claim that a parser pass validates CSS syntax or network behavior. Do not assume external fonts or resources work offline.

## Author, import, and inspect in the app

1. Open **Settings → Theme Store**, then **Create theme**, **Copy and edit**, or import the JSON file. Editing a built-in theme produces a personal copy. Existing IDs offer replacement or a separate copy; choose according to whether the user is updating or forking.
2. Use the preview inspector/right-click to identify tokens. Search tokens or show modified values. Resetting a token removes its override. Apply or discard pending advanced JSON edits before continuing visual editing or exporting.
3. Preview each intended variant, then **Save and apply**. The preview shows the theme itself, while personal appearance preferences can override its accent and typography in the live app. To diagnose a mismatch, inspect the accent's follow-theme setting and **Use personal fonts, size and line height**. Explain their effect; changing someone else's saved preferences is not necessary to produce the theme.
4. Check surfaces, muted text, focus rings, hover/selected menu rows, editor selection/caret, links, code syntax, tables, and popup controls. Check both document and source views and Chinese/Latin text when applicable. Verify UI and editor text remain legible in each variant. If visual inspection was not performed, give this checklist to the author and label it pending.
5. Export the completed theme. If appearance still differs, temporarily disable the author's CSS snippets through the UI to isolate them, within the requested testing scope. Keep a theme copy before replacing or deleting it.

The app stores the library in `themes-v1.json` in its application data directory. Use the UI import/export path instead of editing that store. Missing/invalid themes temporarily fall back to a built-in theme, so seeing a usable app does not prove the custom file loaded.

## Validate from a checkout, when available

For a standalone theme author, use the app's import/advanced JSON validation; Node is optional. A generic JSON Schema check helps with shape and token names but does not replace MarkFlowy's literal validation and reference-cycle resolution.

In an already configured MarkFlowy checkout, reuse its parser through the existing `tsx` dependency. From the repository root, replace the final argument with the absolute path to the generated JSON:

```sh
yarn workspace @markflowy/desktop exec tsx --eval '
  import { readFileSync } from "node:fs";
  import { parseThemeDocument } from "../../packages/theme/src/semantic/index.ts";
  const theme = parseThemeDocument(JSON.parse(readFileSync(process.argv[1], "utf8")));
  console.log(`Valid theme: ${theme.id} (${theme.variants.length} variants)`);
' /absolute/path/my-theme.json
```

This validates the submitted document and resolves every variant; it does not launch the app, validate CSS, or perform a build. Do not substitute an old generated `dist` package for the current source parser.

If the task changes application code as well, follow the checkout's `AGENTS.md`: run affected unit tests, Desktop's `yarn workspace @markflowy/desktop build:types` (`tsc --noEmit`), and lint changed TS/TSX files only. Do not run builds. For a theme-only JSON/CSS output, check that output rather than running unrelated application suites.

## Legacy migration and sharing

Legacy executable JS/npm themes are not loaded or automatically migrated. Inspect their data without executing untrusted theme modules, map the palette to semantic roles, and place variant CSS in `css`. Keep personal CSS as separate snippets. Preserve the original file; do not use the old JS registration or npm publishing workflow for new themes.

When sharing is requested, prepare the exported JSON for a public HTTPS URL and this entry for the repository's root `community-themes.json`:

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "author": "Your name",
  "version": "1.0.0",
  "url": "https://example.com/my-theme.json"
}
```

The catalog ID must match the downloaded document ID. The catalog's string `version` describes the theme release; the document's numeric `version: 1` describes the file format. Replace the example URL with the actual hosted JSON URL before submission. Hosting, publishing, and submitting a PR are separate actions from producing the files and require the user's requested scope.
