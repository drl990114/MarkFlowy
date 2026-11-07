# #1025 table formatting acceptance

Tested on 2026-11-07 with macOS 26.5.2, native Tauri DEV at `localhost:3000`,
MarkFlowy `4d8446f1`, and the installed Capricorn runtime 0.5.13.
This is macOS DEV evidence; Windows, Linux and packaged releases were not tested.

## Native flow

Used an owned temporary Markdown file, starting with three unaligned columns.
The header was `左列 / 中列 / 右列`; body rows contained English, Chinese and numbers.

| Check | Observed result |
| --- | --- |
| Right-click each column and choose left, center, right | Header and every body cell followed the selected column alignment |
| Undo the right alignment, then redo | Only the last column changed back and was restored |
| Save, close the tab, reopen the file | All three alignments remained; saved delimiter was `\| :--- \| :---: \| ---: \|` |
| WYSIWYG and Preview in light and dark themes | Header remained bold with a distinct background; all cell values were readable |
| Application-native PDF, A4 portrait | Completed; rendered page retained alignment, bold header, background and all text |
| Browser PDF, Chrome 156.0.8078.81, A4 portrait | Completed; rendered page retained the same table properties |

Both PDFs were rendered with Poppler and visually inspected. Minor font/layout
differences between WebKit and Chromium did not affect table formatting.
No product defect was found in this scope. The original dark theme was restored;
existing user documents were not edited.

Temporary artifacts are under `/tmp/markflowy-issue1025-closeout`:

- `table-acceptance.md`: document saved through the native app.
- `table-native.pdf`: SHA-256 `481eb08b3f399fe1e7bc327ff7591c423252db6b5bc2adc7bf07917715d87a52`.
- `table-browser.pdf`: SHA-256 `6555fbea0e200243adaceb7d2108acfa8cd7d046e7f4cbdf9013229dd420637a`.
- Corresponding PNGs: first-page renderings used for inspection.

## Automated regression

`tests/capricorn-table-formatting.integration.test.tsx` runs the installed runtime
through the existing published-package configuration. It covers actual menu
actions, whole-column alignment, Markdown serialization and reopening, preview,
header roles, shipped CSS rules and the host's light/dark token bindings.
The DOM test stubs layout geometry; it does not replace the native visual checks.

Passed with Node 24:

```sh
yarn workspace @markflowy/desktop test:capricorn-published tests/capricorn-table-formatting.integration.test.tsx
yarn workspace @markflowy/desktop build:types
node node_modules/@umijs/fabric/node_modules/eslint/bin/eslint.js --resolve-plugins-relative-to node_modules/@umijs/fabric apps/desktop/tests/capricorn-table-formatting.integration.test.tsx
```

Five integration cases passed. No production build was run.
