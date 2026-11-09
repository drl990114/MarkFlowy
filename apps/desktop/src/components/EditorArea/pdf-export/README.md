# In-app PDF export

The in-app path reuses the rendered Preview, resource embedding, heading metadata,
export dialog, native save picker and PDF validation. [Paged.js](https://pagedjs.org/)
pre-paginates that HTML into fixed-size pages inside the application's WebView.
The native export WebView reads accessible headings and their normalized
coordinates from the final physical-page DOM. The system WebView prints those
pages, and Rust `lopdf` maps the coordinates to PDF page boxes to attach
hierarchical bookmarks. The separate Chrome/Edge export option remains available.

Body links use source rectangles and target coordinates from the same final
pagination DOM. Rust replaces the native printout's temporary HTML links with
standard PDF destinations, independently of the bookmark checkbox. This supports
encoded Chinese fragments, wrapped links, cross-page destinations and legacy
named anchors. External URLs retain their fragments; an unknown local target
does not produce a PDF jump. The existing RME HTML sanitizer is unchanged:
authored `id` attributes are stripped, and retained `a[name]` targets receive a
`user-content-` prefix that their links must match. Explicit `id` targets are
covered in trusted prepared-document tests rather than accepted as raw authored
HTML.

Paged.js is bundled JavaScript. This path does not add a Python runtime, separate
Pango bundle, browser executable or font pack, and needs no runtime engine download.
It uses the application's existing WebView and fonts. Operating-system font and
WebView differences can still affect typography; shared pagination code alone
does not establish identical rendering on every platform.

The adapter normalizes supported `:is()` and `:where()` selector lists, preserves
embedded font bytes outside Paged.js's CSS parser, and repeats table headers
before continuation-page layout. Unsupported advanced selectors fail explicitly:
these include mixed-specificity or nested `:is()` lists, selector lists inside
`:not()` or positional selectors, and excessive selector combinations. A document
using these styles can use the separate browser export option.

The compatibility fixture lives in
[e2e/fixtures/pdf-export.ts](../../../../e2e/fixtures/pdf-export.ts). It covers
Chinese text, two Mermaid diagrams, inline and display formulas, a long table,
merged cells, duplicate headings, skipped heading levels, Chinese and encoded
body links, a non-heading named target and backlink, and an external URL
fragment. Historical WeasyPrint reports are retained outside the source tree;
their results do not validate this replacement engine.

## DEV acceptance

[pdf-export-dev.mjs](../../../../e2e/pdf-export-dev.mjs) attaches to an already
running, isolated macOS DEV app compiled with the Cargo `e2e` feature. It does
not start or build an app. Supply the matching owned profile and its running
binary, then run one case:

```sh
MARKFLOWY_E2E_ROOT=/absolute/path/to/owned-profile \
MARKFLOWY_E2E_ID=matching-profile-uuid \
MARKFLOWY_E2E_BINARY=/absolute/path/to/debug/markflowy \
TAURI_WEBDRIVER_PORT=53801 \
node apps/desktop/e2e/pdf-export-dev.mjs \
  --case a4-outline --report-dir /absolute/path/to/report --timeout-ms 600000
```

The five cases are `a4-outline`, `a4-no-outline`, `letter-landscape`, `save-cancel`
and `overwrite-cancel`. The runner opens the fixture through the real CLI and
uses the actual editor menu and export dialog. It writes `pending-picker.json`
when a native picker needs an external operator. Complete the requested save or
cancellation there; the runner resumes when the application finishes. It does
not stub the picker or invoke a rendering helper instead of the UI flow.

Each scenario refreshes the frontend first so DEV HMR listeners cannot leak into
the next export, then waits up to 60 seconds for the owned runtime manifest to
advertise the `main` window and CLI commands before opening or reusing the fixture.
The export dialog is polled with a fresh locator for up to 60 seconds; a timeout
fails the scenario without clicking Export a second time.
To reuse an already CLI-opened fixture in the same owned profile,
add `--reuse-receipt /absolute/path/to/previous/a4-outline.open-receipt.json`.
Only a successful receipt whose source path, content SHA256, `main` window and
file ID match the current fixture and active editor is accepted. A matching tab
title alone is insufficient; omit this option to open the fixture through the CLI.

Successful exports are checked with PDF.js for selectable Chinese and diagram
labels, all 70 unique table rows, repeated table headers, page geometry, absence
of blank pages, inline-formula text baselines, and bookmark hierarchy and precise
heading destinations. Body-link checks bind each printed CJK label fragment to
its own PDF Link rectangle, validate every fragment's target page and XYZ
coordinates, and verify the external URL and fragment remain unchanged. They
also reject unexpected temporary HTML file URIs; explicitly authored external
file URLs remain legitimate. Cancellation checks preserve source bytes, create
no new PDF, and preserve an existing output when replacement is cancelled.
Reports retain PDFs, screenshots, page source and frontend errors for visual review of
formula paths, diagram shapes and table layout.

The runner saves `frontendErrorsBeforeExport` and `frontendErrorsAfterExport` and
requires the exception list to remain unchanged during export. Any pre-export
baseline errors remain in the report; their presence does not establish their
cause. A passing export means no new recorded frontend exceptions during that
operation and does not by itself establish a globally empty exception list.

The macOS DEV check with the system PingFang font found a text-extraction
limitation: Quartz can map a shared Chinese glyph to a CJK radical code point.
The page renders correctly, text remains selectable, and bookmark titles retain
their source Unicode, but copied text and exact text searches may differ from
the original code points. For example, printed `页` (U+9875) was extracted as `⻚`
(U+2EDA), which NFKC alone does not normalize.

For comparison and position assertions, the runner removes whitespace, applies
NFKC and adds only the documented
[Equivalent_Unified_Ideograph](https://www.unicode.org/Public/17.0.0/ucd/EquivalentUnifiedIdeograph.txt)
mapping U+2EDA → U+9875. It does not change the PDF. The result preserves
`pdf.textExtraction.sourceAbsentRadicals` and records
`exactChineseCodepointsPreserved: false` when it finds radical code points absent
from the source; comparison success does not hide that limitation.

For visual QA of the three successful export cases, pass their real PDFs to
[pdf-export-visual-qa.mjs](../../../../e2e/pdf-export-visual-qa.mjs):

```sh
node apps/desktop/e2e/pdf-export-visual-qa.mjs \
  --a4-outline /absolute/path/to/a4-outline.pdf \
  --a4-no-outline /absolute/path/to/a4-no-outline.pdf \
  --letter-landscape /absolute/path/to/letter-landscape.pdf \
  --output-dir /absolute/path/to/new-visual-report
```

This requires Poppler's `pdfinfo` and `pdftoppm` on `PATH`. It validates existing
PDFs, renders every page to PNG and records input hashes and page counts in a
manifest. Successful rendering leaves visual review pending; inspect the images
for diagram shapes, formula paths, table borders, clipping and blank pages.

The isolated macOS DEV run on 2026-11-08 passed all five native UI cases:
A4 with bookmarks (6 pages, 10 bookmarks), A4 without bookmarks (6 pages, none),
Letter landscape (9 pages, 10 bookmarks), save cancellation, and overwrite
cancellation. The cancellations preserved the source and existing output, and
did not create a new PDF. Pre-export and post-export exception arrays are
retained; none of the five cases added recorded exceptions.

Poppler visual review covered all 21 exported pages. The light Mermaid diagrams
have readable labels and lines; inline and display formulas, repeated table
headers and merged cells are intact, with no observed content clipping or blank
pages. The two A4 files render identically on every page. The Chinese extraction
code-point limitation above remains present.

After the body-link fix, the three native export PDFs also passed 14 real pointer
clicks in an isolated, unmodified PDF.js viewer: five per A4 file, including both
halves of the wrapped encoded link, and four in Letter landscape. The actual
TextLayer character ranges matched their AnnotationLayer rectangles, and clicks
changed the page and scroll position to the expected visible target. This
includes the A4 export with bookmarks disabled. External URL fragments stayed
unchanged, and no temporary HTML URI remained. These reader checks supplement
the native export flow; they do not substitute for it.

The same A4 PDF also passed four real pointer clicks in MarkFlowy's native DEV
PDF preview: the Chinese heading link, the encoded heading link, the named
footnote target and its backlink. Viewport mouse down/up events changed the
preview's page and scroll position, and the expected target text was visible.
The source PDF hash remained unchanged and the preview recorded no frontend
exceptions before or after these clicks. These four native-app clicks are
separate from the 14 isolated PDF.js clicks.

Type and unit checks do not establish native printing or installer acceptance.
Linux and Windows native verification and production packaging remain unverified.
