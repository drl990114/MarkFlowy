# Startup performance work

## Target and evidence boundary

The target is process-cold launch on the current Mac with local files: a Markdown
document of up to 200 KiB is visible and accepts input within 1 second at P95;
first input feedback is within 50 ms at P95. An OS-reboot first launch and 2 MiB
documents are separate measurements. Rendering a shell or hiding a loader does
not meet the document target.

The current changes have source, TypeScript and unit-test evidence only. No
production build, native cold-launch timing, production bundle size, or P95
acceptance has been obtained. Builds are intentionally omitted under the user's
validation instruction. Runtime source changes and published artifacts must be
reported separately.

## Implemented host changes, 2026-09-24

- Read settings and workspace/session inputs concurrently. A startup attempt
  shares its input promise; retry creates a new attempt and reads fresh inputs.
- Once the restored active document and mode are known, prepare the editor area
  and the selected Capricorn factory while draft selection proceeds. A dirty or
  pending draft is never replaced with prefetched disk content.
- After visible draft recovery, start the active document read and hand its
  promise/result to that editor once. Workspace identity, active file, content
  revision, disk revision, dirty/pending state, cancellation and fresh watcher/save
  reads invalidate the handoff. Normal file snapshot reads still do not cache
  settled disk results.
- Keep lightweight command-palette and Quick Open controllers mounted, then load
  their bodies on demand. Capture the original editor selection before module
  loading. Preserve dialog focus, IME behavior, cancellation, history and retry.
  Load the update-notes Markdown renderer only when notes will be shown.
- Introduce an editor-readiness gate independent of diagnostic opt-in. A current,
  visible input surface and document content must survive two animation frames;
  visible pending code editors hold readiness. Empty, preview/read-only and error
  outcomes release background work without claiming editable Markdown.
- Schedule the initial directory scan, updates and error-reporter initialization
  after readiness. Keep safety listeners and draft protection on their existing
  early path. Restore the selected custom theme promptly and hold other theme
  extensions until readiness.
- Reuse the startup system appearance, coalesce overlapping system-theme queries,
  and reject a query result superseded by a newer OS theme event.
- Add a lightweight `@markflowy/i18n/desktop` entry. Load current language plus
  English, load another language on selection, and retain the legacy complete
  resources for other consumers. Both entries share the i18next singleton. Desktop
  aliases shared consumers to the lightweight entry.
- Combine startup stages and the matching editor request in the startup report,
  including configured host version, development/production mode, resolved
  runtime version and entry SHA-256. Keep painted input feedback separate from
  model-publication lag.
- Read a native draft index without selecting object bodies. Claim one exact
  document/writer/sequence/hash under a SQLite `IMMEDIATE` transaction, checking
  the current document generation, path, format, baseline and window presence.
  Validate the body before transferring ownership; stable claim ids make retries
  after a lost IPC response idempotent. Closed windows release their presence
  when recovery next checks the native window registry, without deleting drafts.
  This uses the existing rusqlite/SQLite stack and its
  [transaction guarantees](https://www.sqlite.org/lang_transaction.html).
- Recover the selected document first; each other visible split has its own
  recovery gate. Start hidden bodies after the interactive gate, using the
  existing bounded priority queue, and promote a document when selected. A
  failed body stays behind a retry surface and cannot be saved as empty text.
  Close and workspace changes explicitly start and await all pending recovery;
  CLI readiness waits for first paint and complete recovery.
- Write a version 2 exit manifest containing only references to acknowledged
  SQLite drafts. Publish the close barrier before asynchronous protection, and
  retain previous sessions if close/persistence fails. Browser previews retain
  self-contained version 1 exit snapshots.
- On WebView reload, synchronously write immutable per-document sessionStorage
  bodies, then replace the small manifest. A partial body/head write rolls back
  newly created keys while retaining the previous complete snapshot. Pending
  native/reload references survive without loading their hidden bodies. Startup
  also reads version 1 full sessions and only consumes them after successful,
  durable recovery. Distinct native writers keep separate drafts.
- Record native context/setup, appearance bootstrap, WebView construction and
  page-load events on the same monotonic clock. Report only process-wide stages
  and the current window; clear closed-window entries and replace reload events
  without retaining URLs or a navigation log. Sample once at entry and once at
  readiness, retaining the newer native snapshot and the tighter IPC clock fit.
  Report the native binary's version and debug/release mode separately from the
  frontend configuration.
- Include the existing process-session UUID in native reports so repeated
  windows or reloads cannot be counted as fresh process-cold samples. Version the
  exported startup report. Compute an opt-in SHA-256 of the initial decoded UTF-8
  document after readiness, reusing the existing diagnostic encoding; unavailable
  or failed Web Crypto leaves the fingerprint missing without affecting editing.
- Preserve the first unpainted input's start time across a burst of input events.
  Record whether that event was trusted, so script-dispatched events cannot pass
  the native-input evidence check. The measurement ends at the next animation
  frame after a document mutation; it is a feedback proxy, not proof of physical
  screen presentation or event-queue/keyboard latency.

## Implemented Capricorn source changes, 2026-09-25

The source checkout is `/Users/dongruilin/Desktop/repo/me/capricorn`, branch
`codex/incremental-document-work`, based on `16faf9b`. These changes are
uncommitted and are not in the runtime installed by MarkFlowy. The installed
runtime remains version `0.2.9`, with entry SHA-256
`b784ce4aa3061a8a3c702092e5626d213ddf9f984cd0aa15a3a26966ccfa0e4e`.

- Support optional initialization progress for synchronous creation as well as
  asynchronous creation. Report parse, plugin construction, model, index,
  controller, mount and ready stages. Controller and mount durations contain
  nested work and must not be summed. Observer failures cannot break creation.
  MarkFlowy associates synchronous callbacks with the current document/request
  and ignores callbacks from disposed or superseded sessions.
- Separate code-block context, styles and clipboard helpers from the CodeMirror
  implementations. The runtime and Markdown entry's static import graphs no
  longer reach CodeMirror. Plain paragraphs and ordinary rendered links do not
  evaluate embedded source-editor modules in the DOM regression fixture.
- Reuse block virtualization: mounted code, HTML/math/Mermaid and Frontmatter
  groups load their implementation on demand; inline link source loads when
  editing opens. Share in-flight imports, retain a bounded text fallback and
  retry rejected loads. Preserve source, selection navigation, read-only controls,
  clipboard behavior and undo. Cancelled link editing or later external focus
  prevents a late module from taking focus; disposal cannot resurrect an editor.
- Keep pending source editors visible to the host's readiness check. A visible
  module failure releases background work with an error outcome, retaining the
  retry UI without claiming editable readiness.
- Construct the configured clipboard Markdown renderer on first copy and reuse
  it afterward. Preserve task lists, emoji, formatting and URL/HTML handling.
- Keep Markdown parsing semantics and the 256 KiB async threshold unchanged.

## Remaining work from the approved plan

1. Produce and integrate matching runtime/application test artifacts through the
   normal packaging path, after resolving the user's current no-build constraint.
   Source integration tests do not update the production pin; editing generated
   output is not a substitute for a verified artifact. No release was published.
2. Collect actual native timing against matching host/runtime artifacts and repeat
   the matrix below before claiming the target is achieved.

## Validation

Use Node 24. The final expanded host regression pass covered 54 test files and
467 tests; all passed. Explicit Capricorn source integration passed 10 files and
69 tests, including host shortcuts, search, selection recovery and link editing.
Desktop and i18n TypeScript checks passed. Changed-file ESLint passed with no
errors and five existing warnings in untouched TextEditor statements.

Capricorn passed 198 public runtime behavior tests, source-block/navigation/focus
and localization regressions, the public API and semantic contracts, keyboard and
IME DOM suites, and the new module-loading/retry/disposal, static import and
clipboard-initialization checks. Source, debug and strict TypeScript checks
passed; changed-file ESLint passed without warnings. These are DOM event
simulations, not native Chinese-input or WebView latency evidence.

The local-history crate passed 37 Rust unit tests; the Desktop history IPC
dispatcher passed 3 and native startup timing passed 3. Desktop Rust tests compile
the test harness and report existing unused/dead-code warnings, not a production
application build or a native UI launch.
Editor integration tests still emit nested React root / `flushSync` warnings;
passing those tests does not establish native timing or rendering acceptance.

```sh
fnm exec --using=24 yarn workspace @markflowy/desktop build:types
fnm exec --using=24 node node_modules/typescript/bin/tsc --noEmit -p packages/i18n/tsconfig.json
fnm exec --using=24 yarn workspace @markflowy/desktop test src/startup src/i18n/desktop.test.ts src/components/DeferredSurface.test.tsx src/components/EditorArea/fileSnapshot.test.ts src/components/EditorArea/openingReadQueue.test.ts src/components/EditorArea/editorPerformanceDiagnostics.test.ts src/components/EditorArea/capricornRuntimeDom.test.ts src/components/EditorArea/editorSnapshotRegistry.test.ts src/components/EditorArea/externalFileChanges.test.ts src/components/EditorArea/TextEditor src/components/EditorArea/CapricornEditor.test.tsx src/components/EditorArea/capricornRuntimeAdapter.test.ts src/components/EditorArea/Editor.lifecycle.test.tsx src/router/Root src/extensions/command-palette src/extensions/quick-open src/stores/useThemeStore.test.ts src/stores/useThemeStore.staleStartup.test.ts src/services/staged-draft-recovery.test.ts src/services/draft-recovery.test.ts src/services/local-history.test.ts src/services/checkUnsavedFiles.test.tsx src/services/workspace-session.test.ts src/services/cli.test.ts --reporter=dot
fnm exec --using=24 yarn workspace @markflowy/desktop test:capricorn-source
cargo test -p mf_local_history --lib
cargo test -p markflowy local_history::tests --lib
cargo test -p markflowy startup_timing::tests --lib
```

In the Capricorn source checkout:

```sh
fnm exec --using=24 node node_modules/typescript/bin/tsc --noEmit
fnm exec --using=24 node node_modules/typescript/bin/tsc --noEmit -p tsconfig.debug.json
fnm exec --using=24 node scripts/check-strict-types.mjs
fnm exec --using=24 node tests/test-runtime-behavior.mjs
fnm exec --using=24 node tests/test-startup-import-boundary.mjs
fnm exec --using=24 node tests/test-source-module-loading-dom.mjs
fnm exec --using=24 node tests/test-clipboard-startup-runtime.mjs
fnm exec --using=24 node node_modules/eslint/bin/eslint.js <changed-files> --max-warnings 0
```

Lint only changed `.ts`/`.tsx` files, without fixing them. The existing nested
ESLint 8 installation needs its own plugin resolution directory in this checkout:

```sh
fnm exec --using=24 node node_modules/@umijs/fabric/node_modules/eslint/bin/eslint.js --resolve-plugins-relative-to node_modules/@umijs/fabric <changed-files>
```

The source dependency guard verifies that the application entry cannot reach
RME, CodeMirror commands, react-markdown or remark-gfm through local static
imports. This is a boundary regression test, not a production chunk measurement.

The measurement-tooling follow-up passed 28 focused frontend tests, 20 Node
fixture/report tests (including the existing 2 MiB reporter), and 3 native timing
unit tests. Desktop TypeScript and changed-file ESLint passed without errors or
warnings. These tests use synthetic timing records and establish validator
behavior, not a measured startup result.

```sh
fnm exec --using=24 yarn workspace @markflowy/desktop test src/startup/performance.test.ts src/components/EditorArea/editorPerformanceDiagnostics.test.ts --reporter=dot
fnm exec --using=24 node --test scripts/export-editor-opening-fixtures.test.mjs scripts/report-editor-opening.test.mjs scripts/report-startup-performance.test.mjs
```

## Native acceptance procedure

Enable local editor diagnostics once in the target WebView, then completely quit
the application before process-cold runs:

```js
localStorage.setItem('mf:editor-performance', '1')
```

After a visible edit has produced feedback, capture:

```js
window.__MF_STARTUP_PERFORMANCE__.getReport()
```

The report retains navigation timing and the native-entry uncertainty interval
from IPC clock calibration. `hostVersion` comes from frontend configuration;
`native.hostVersion` and `native.buildKind` describe the running binary. Native
stages are the latest captured snapshot, with `sampledAtElapsedMs` identifying its
cutoff. A missing later stage is not evidence of completion. Verify artifact
hashes independently and also measure the external launch-to-native-entry time:
the Rust entry clock excludes OS process creation and loader work. Missing
first-input or runtime timing remains missing evidence. Do not substitute model
commit time, React mount time, or a jsdom test duration for visible input latency.

The report's `native.processSessionId` stays the same for every window in one
process. Capture each cold sample after a complete exit and a new launch. Wait
for `editor.open.contentSha256` before saving the report, and keep the initial
document unchanged until it becomes editable. The fingerprint refers to the
initial content, so the subsequent test keystroke does not change it. A missing
hash, first-input result or native clock remains missing evidence. Use real
keyboard/native automation input; `dispatchEvent` input is deliberately rejected
by the collector's trusted-event check. Trusted events alone do not establish
physical display latency or correct IME behavior.

Run at least 30 samples per scenario, recording artifact identity and separating
development, process-cold, warm window, reload and OS-reboot launches:

| Scenario | Required behavior |
| --- | --- |
| Empty session | Usable workbench; background work is released |
| One Markdown document, up to 200 KiB | Visible editable content and first input target |
| Twenty restored tabs | Active document first; hidden editors remain unmounted |
| Many hidden drafts | Active recovery independent of hidden bodies and validation |
| Two split panes | Correct group/selection; independent visible recovery |
| Lists, tables, code, Chinese text | Same Markdown behavior and correct IME handling |
| 2 MiB document | Separate large-document timing and responsiveness |
| Edit, switch, close or external change during restore | No stale content, lost input or resurrected documents |
| Multiple windows and failed storage/module loads | Correct claims, retained recovery sources and retry |

## Recorded cold-start timing report

Reuse the existing deterministic fixture generator. Its default remains 2 MiB;
the explicit byte count below produces the 200 KiB startup fixtures without
overwriting existing files:

```sh
fnm exec --using=24 node scripts/export-editor-opening-fixtures.mjs --output-dir /absolute/path/to/startup-fixtures --fixture ordinary --bytes 204800
fnm exec --using=24 node scripts/report-startup-performance.mjs /absolute/path/to/startup-cases.json
```

The new reporter uses the existing nearest-rank percentile function. It requires
at least 30 retained runs **per case**, checks the initial bytes/hash and matching
editor, process and artifact identities, and uses the **upper** clock bound for
the 1,000 ms P95 gate. Timeouts and crashes remain rows and prevent passing even
when 30 other runs succeeded. Missing launch-to-native-entry time is never
replaced by zero. Do not drop slow, failed or first-use runs from the input.

The input is a local JSON object shaped as follows. Angle-bracket values are
placeholders; `report` must be the complete unmodified object returned by
`window.__MF_STARTUP_PERFORMANCE__.getReport()`, not a handwritten summary.

```json
{
  "schemaVersion": 1,
  "environment": { "engine": "tauri-webview", "device": "<Mac model>", "os": "<macOS version>" },
  "artifact": {
    "hostVersion": "<matching application version>",
    "hostBinarySha256": "<64 lowercase hex digits>",
    "runtimeVersion": "<matching runtime version>",
    "runtimeEntrySha256": "<64 lowercase hex digits>",
    "runtimeTarballSha256": "<64 lowercase hex digits>"
  },
  "cases": [{
    "scenario": "single-document",
    "fixture": "paragraph",
    "byteLength": 204800,
    "launchKind": "process-cold",
    "setup": { "localFiles": true },
    "runs": [{
      "runId": "<unique run identifier>",
      "status": "completed",
      "launchToNativeEntryMs": { "min": "<measured lower bound in ms>", "max": "<measured upper bound in ms>" },
      "report": "<complete exported report object>"
    }, {
      "runId": "<another unique run identifier>",
      "status": "timeout"
    }]
  }]
}
```

The string launcher bounds in this shape are placeholders rejected by the tool.
Replace them with independently measured numeric bounds from the external launch trigger
to Rust entry, using a shared monotonic trace or equivalent calibration. The
Rust entry clock and WebView navigation alone cannot supply that missing time.
`status: completed` requires actual completion; failed runs may retain any
partial `report` alongside statuses such as `timeout` or `crashed`.

The recorded timing matrix covers `single-document` with `paragraph`,
`mixed-ordinary`, `cjk` and `tables`, plus `restored-tabs`, `hidden-drafts` and
`split-panes` with `mixed-ordinary`. The latter three declare respectively
`setup.restoredTabs >= 20`, `setup.hiddenDrafts >= 20`, or `setup.panes: 2`.
Each target case uses local files, Capricorn WYSIWYG mode, 204800 initial UTF-8
bytes, a production frontend and a release native binary. These are seven cases
and at least 210 process-cold samples, not 30 pooled across different scenarios.

`launchKind` also accepts `warm-window`, `reload` and `os-reboot`; other fixture
sizes and stress structures remain separate reports and cannot satisfy the
200 KiB cold-start gate. For warm windows/reloads only navigation-to-editable time
is summarized as an opening duration, since native-entry time includes existing
process uptime. The older `report-editor-opening.mjs` remains a separate 2 MiB
document-opening tool.

Exit code 0 means the **recorded numeric timing gate** passed. The reporter does
not launch an app, verify declared device/session setup, hash a running binary,
or inspect pixels. It returns `environmentVerifiedByTool: false`; matching
artifact provenance, visual readiness, native Chinese IME, split-pane correctness
and forced-quit recovery still require their own evidence. Source-mode and empty
workbench behavior are also outside this WYSIWYG numeric gate.

## Capricorn 0.3.0 release integration, 2026-09-26

The published runtime is now installed and pinned in MarkFlowy. This supersedes
the `0.2.9` installation status recorded above; previous timing reports remain
historical evidence.

| Artifact | Identity |
| --- | --- |
| Package | `@drl990114/capricorn-runtime@0.3.0` |
| Release tag | `capricorn-v0.3.0` |
| Capricorn source commit | `99e95beb5fb81e70902f5759175f0ceccd9e6c8d` |
| Published tarball SHA-256 | `d2b47b330546c09b61deca83372066c950ea2970fc087f224b1011ab5dcde542` |
| Installed `dist/index.js` SHA-256 | `980a85471b2d2182900f4477dae4d988fb16a8789e4c9cdf0d9ba355e9a5c6a7` |

The [tag release workflow](https://github.com/drl990114/capricorn/actions/runs/36220348380)
succeeded, including 144 runtime/contract scripts and 16 TypeScript test files.
The release combines the committed editor-module, selection-foreground and
Copilot work with the theme contract changes; the unrelated uncommitted bidi
work is excluded. MarkFlowy's installer verified the downloaded tarball hash
before installation, then confirmed the installed package name and exact version.
The entry hash above identifies the installed JavaScript entry and is distinct
from the tarball hash.

Source and installed-package integration each passed 75/75 tests across 11
files; the installed-package run completed in 26.13 seconds. Resolver tests
passed 44/44. Desktop and integration TypeScript checks and changed-file lint
passed. Both integration suites retain existing React `flushSync` and synchronous
unmount warnings; these were successful test runs, not warning-free runs.

These are source, package, type and DOM-test results. No MarkFlowy build was
run for this integration, and there are no new Tauri/WebView visual, native IME,
startup timing or P95 measurements. The runtime release build in its tag CI is
separate from a MarkFlowy application build.

Run checks serially from the MarkFlowy root, with a 4 GB Node heap and one test
worker. For the source command, explicitly point `CAPRICORN_SOURCE_ROOT` to a
clean `capricorn-v0.3.0` checkout at the source commit listed above. The sibling
working tree contains additional unpublished bidi changes and is not the release
source used for this validation. Resolve the checkout's real path as shown below;
on macOS, `/var` and `/private/var` aliases must not resolve the same source tree
under different importer paths:

```sh
NODE_OPTIONS=--max-old-space-size=4096 fnm exec --using=24 yarn workspace @markflowy/desktop build:types
NODE_OPTIONS=--max-old-space-size=4096 fnm exec --using=24 yarn workspace @markflowy/desktop exec tsc --noEmit -p tsconfig.capricorn-integration.json
NODE_OPTIONS=--max-old-space-size=4096 fnm exec --using=24 yarn workspace @markflowy/desktop exec vitest run capricornRuntimeResolver.test.ts --maxWorkers=1 --no-file-parallelism
NODE_OPTIONS=--max-old-space-size=4096 CAPRICORN_SOURCE_ROOT="$(realpath /absolute/path/to/capricorn-v0.3.0)" fnm exec --using=24 yarn workspace @markflowy/desktop exec vitest run --config vitest.capricorn-source.config.ts --maxWorkers=1 --no-file-parallelism
NODE_OPTIONS=--max-old-space-size=4096 fnm exec --using=24 yarn workspace @markflowy/desktop exec vitest run --config vitest.capricorn-published.config.ts --maxWorkers=1 --no-file-parallelism
```

`build:types` runs `tsc --noEmit`; it does not build application assets. Use the
repository's ESLint 8 runner only for changed TypeScript files, without `--fix`.

## Capricorn 0.3.1 release integration, 2026-09-26

MarkFlowy now installs and pins `@drl990114/capricorn-runtime@0.3.1`. This
supersedes the installation status above while preserving the 0.3.0 theme
contract and historical timing records.

| Artifact | Identity |
| --- | --- |
| Release tag | `capricorn-v0.3.1` |
| Capricorn source commit | `28fce171be84262e316df7c3fb7da7ba9163c8e5` |
| Published tarball SHA-256 | `c1999e566d1bb43030bfb5758e3eea2a3e291c1914e3f9baebc8aac40a0b6b18` |
| Release source fingerprint | `772cdf1f39edc90eaea1d6f64c002413e43efe5f39b87f073a74f8ae07942be7` |
| Installed `dist/index.js` SHA-256 | `043781ae4d34e04fa08260483ab540a0791c20087d77c3721c5c9a3ef2d358af` |
| Audited installed files | 259, exact file list and bytes match the published tarball |

The [publish workflow](https://github.com/drl990114/capricorn/actions/runs/36226514245)
and [Check workflow](https://github.com/drl990114/capricorn/actions/runs/36226514216)
both succeeded at the source commit above. The release passed 144 runtime and
contract scripts, 16 TypeScript test files, type checks, lint and architecture
checks. CI built the runtime, passed 203 isolated tarball tests and published to
GitHub Packages. The downloaded registry tarball matches both registry integrity
metadata and the release workflow's verification manifest. MarkFlowy's installer
verified the pinned hash; a separate audit compared every installed file with the
verified tarball.

The release was prepared in a clean, updated main worktree. It includes the
23-file editor presentation refinement, one existing asynchronous test correction
and one default-font assertion update. The original sibling checkout's unrelated
uncommitted bidi and source-navigation work was excluded and preserved. Source
integration used the clean release checkout's real path, not the dirty sibling.

| Consumer validation | Result |
| --- | --- |
| Clean release source integration | 11 files / 76 tests passed, 39.99 seconds |
| Installed published runtime integration | 11 files / 76 tests passed, 27.07 seconds |
| Full Desktop unit tests (`--maxWorkers=4`) | 253 files / 1551 tests passed, 41.82 seconds |
| Desktop `build:types` and integration `tsc --noEmit` | Passed |
| Changed-file ESLint and installer syntax check | Passed |
| Translation key consistency | Passed |

The added host integration case uses real Mermaid rendering and sanitization.
It checks different simultaneous light/dark instances, theme-change redraws,
cache isolation and unchanged Markdown, selection and undo/redo availability.
Only geometry missing from jsdom is supplied; SVG stylesheet rules are evaluated
through an HTML style element because jsdom does not register SVG stylesheets.
These tests retain existing React `flushSync` and synchronous unmount warnings.

Host resources now include the missing table and live-preview labels in English,
Chinese, Spanish, French and Japanese. All 36 runtime keys in those namespaces
are covered, interpolation placeholders match and existing translations are
preserved. Translation consistency and representative i18next interpolation
checks passed.

A Chrome fixture loaded the installed runtime through the real host editor and
theme providers with mocked Tauri services. Using the actual Desktop
virtualization options, light/dark and English/Chinese switches kept the editor
instance and edited Markdown unchanged. Mermaid remained readable; menus used
13px text and 28px rows, while compact snippet/link fields and preview actions
used 24px hit areas. The nonvirtualized fixture also exposed an existing code
continuation fallback issue shared with 0.3.0; it does not occur with the Desktop
virtualization configuration. This release does not fix that separate path.

After the locale update, the same fixture displayed Chinese table actions and
Mermaid source controls with the expected geometry and unchanged document and
editor root. Other existing fallback labels in the separate code/preview
namespaces are outside this translation update.

Use the serial 4 GB / single-worker integration commands above with a clean
`capricorn-v0.3.1` checkout. No MarkFlowy application or RME package build was
run, following the requested validation scope. Capricorn's authorized release
build and Chrome fixture checks are separate from Tauri/WebView, native IME,
startup timing and P95 acceptance; none of those measurements is claimed here.
