import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { createEditorOpeningFixture } from '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts'
import { reportStartupPerformance } from './report-startup-performance.mjs'

const hash = 'a'.repeat(64)
let sequence = 0
function makeCase(options = {}) {
  const entry = {
    scenario: 'single-document', fixture: 'paragraph', launchKind: 'process-cold', byteLength: 200 * 1024,
    setup: { localFiles: true, restoredTabs: 20, hiddenDrafts: 20, panes: 2 }, ...options,
  }
  const contentSha256 = createHash('sha256').update(createEditorOpeningFixture(entry.fixture, entry.byteLength)).digest('hex')
  entry.runs = Array.from({ length: 30 }, () => {
    const id = String(++sequence)
    return {
      runId: `run-${id}`, status: 'completed', launchToNativeEntryMs: { min: 10, max: 20 },
      report: {
        schemaVersion: 1, hostVersion: '0.7.0', buildKind: 'production',
        runtime: { version: 'test-runtime', entrySha256: hash },
        timeOrigin: 1_000_000 + sequence, windowLabel: 'main',
        navigationType: entry.launchKind === 'reload' ? 'reload' : 'navigate',
        nativeClockAvailable: true, calibrationRoundTripMs: 10,
        native: {
          processSessionId: `process-${id}`, hostVersion: '0.7.0', buildKind: 'release', sampledAtElapsedMs: 420,
          stages: [
            ['native-entry', 0], ['context-ready', 10], ['setup-start', 20], ['configuration-ready', 30],
            ['window-start', 40, 'main'], ['window-bootstrap-ready', 50, 'main'], ['webview-build-start', 60, 'main'],
            ['window-built', 90, 'main'], ['setup-end', 100], ['page-load-start', 120, 'main'], ['page-load-finished', 380, 'main'],
          ].map(([name, elapsedMs, windowLabel]) => ({ name, elapsedMs, ...(windowLabel ? { windowLabel } : {}) })),
        },
        editor: {
          detailedDiagnosticsEnabled: true,
          context: { fileId: 'file', viewId: 'left', mode: 'wysiwyg', openRequestId: `open-${id}` },
          firstInputFeedbackMs: 16,
          open: {
            fileId: 'file', viewId: 'left', mode: 'wysiwyg', openRequestId: `open-${id}`,
            runtimeVersion: 'test-runtime', runtimeEntrySha256: hash,
            kind: 'open', status: 'ready', duration: 70, contentRevision: 0, byteLength: entry.byteLength, contentSha256,
            firstInputDuration: 16, firstInputTrusted: true,
            stages: [['runtime-ready', 50], ['surface-committed', 60], ['ready', 70], ['content-measured', 75]]
              .map(([stage, elapsedMs]) => ({ stage, elapsedMs })),
          },
        },
        stages: [
          { name: 'mf:startup:webview-start', navigationElapsedMs: 0, nativeElapsedMs: { min: 140, max: 150 } },
          { name: 'mf:startup:entry-modules-ready', navigationElapsedMs: 10, nativeElapsedMs: { min: 150, max: 160 } },
          { name: 'mf:startup:interactive-editable', navigationElapsedMs: 250, nativeElapsedMs: { min: 390, max: 400 } },
        ],
      },
    }
  })
  return entry
}
function input(cases = [makeCase()]) {
  return {
    schemaVersion: 1,
    environment: { engine: 'tauri-webview', device: 'test Mac', os: 'test macOS' },
    artifact: { hostVersion: '0.7.0', hostBinarySha256: hash, runtimeVersion: 'test-runtime', runtimeEntrySha256: hash, runtimeTarballSha256: hash },
    cases,
  }
}
function first(input) { return reportStartupPerformance(input).cases[0] }
function issue(mutator, expected) {
  const value = input()
  mutator(value.cases[0].runs[0], value)
  const result = first(value)
  assert.equal(result.recordedTimingGatePassed, false)
  assert.equal(result.runs, 30)
  assert.ok(result.invalidRuns[0].reasons.includes(expected), JSON.stringify(result.invalidRuns))
}

test('adds external launcher bounds and uses nearest-rank P95 without mixing navigation clocks', () => {
  const result = reportStartupPerformance(input())
  const entry = result.cases[0]
  assert.deepEqual(entry.launchToEditableMs.upper, { samples: 30, p50: 420, p95: 420, max: 420 })
  assert.equal(entry.launchToEditableMs.lower.p95, 400)
  assert.equal(entry.navigationToEditableMs.p95, 250)
  assert.equal(entry.firstInputFeedbackMs.p95, 16)
  assert.equal(entry.recordedTimingGatePassed, true)
  assert.equal(result.recordedTimingGatePassed, false)
  assert.equal(result.missingCases.length, 6)
  assert.equal(result.environmentVerifiedByTool, false)
})

test('requires the full process-cold fixture/session matrix before the recorded timing gate passes', () => {
  const cases = ['paragraph', 'mixed-ordinary', 'cjk', 'tables'].map((fixture) => makeCase({ fixture }))
  cases.push(...['restored-tabs', 'hidden-drafts', 'split-panes'].map((scenario) => makeCase({ scenario, fixture: 'mixed-ordinary' })))
  const result = reportStartupPerformance(input(cases))
  assert.equal(result.recordedTimingGatePassed, true)
  assert.deepEqual(result.missingCases, [])
  assert.equal(result.cases.reduce((total, entry) => total + entry.runs, 0), 210)
})

test('retains failed and missing reports, and never substitutes zero for missing launcher/input evidence', () => {
  issue((run) => { run.status = 'timeout'; delete run.report }, 'missing-startup-report')
  issue((run) => { delete run.launchToNativeEntryMs }, 'missing-launch-to-native-entry-bounds')
  issue((run) => { run.launchToNativeEntryMs = { min: 10, max: 9 } }, 'missing-launch-to-native-entry-bounds')
  issue((run) => { delete run.report.editor.open.firstInputDuration; run.report.editor.open.firstInputCommitDuration = 1 }, 'missing-trusted-first-input-feedback')
  issue((run) => { run.report.editor.open.firstInputTrusted = false }, 'missing-trusted-first-input-feedback')
  issue((run) => { run.report.editor.firstInputFeedbackMs = 1 }, 'missing-trusted-first-input-feedback')
  const value = input()
  value.cases[0].runs.push({ runId: 'failed-extra', status: 'crashed' })
  assert.equal(first(value).validRuns, 30)
  assert.equal(first(value).recordedTimingGatePassed, false)
  value.cases[0].runs.length = 29
  assert.ok(first(value).reasons.includes('fewer-than-30-runs'))
})

test('rejects relabeled warm processes, copied runs and reports from another document or artifact', () => {
  issue((run, value) => { run.report.native.processSessionId = value.cases[0].runs[1].report.native.processSessionId }, 'reused-cold-process')
  issue((run, value) => { run.runId = value.cases[0].runs[1].runId }, 'duplicate-run-id')
  issue((run, value) => { run.report.editor.open.openRequestId = value.cases[0].runs[1].report.editor.open.openRequestId }, 'missing-or-mismatched-editor-identity')
  issue((run) => { run.report.editor.context.viewId = 'another-pane' }, 'missing-or-mismatched-editor-identity')
  issue((run) => { run.report.native.buildKind = 'debug' }, 'not-release-build')
  issue((run) => { run.report.runtime.entrySha256 = 'b'.repeat(64) }, 'artifact-identity-mismatch')
  issue((run) => { run.report.native.hostVersion = 'older-host' }, 'artifact-identity-mismatch')
  issue((run) => { run.report.editor.open.contentSha256 = 'b'.repeat(64) }, 'initial-content-mismatch')
  issue((run) => { run.report.editor.open.byteLength += 1 }, 'initial-content-mismatch')
  issue((run) => { run.report.editor.open.mode = 'sourceCode' }, 'not-wysiwyg')
  issue((run) => { run.report.navigationType = 'reload' }, 'wrong-navigation-kind')
})

test('validates bounded clocks, current-window stages and editable outcomes', () => {
  issue((run) => { run.report.nativeClockAvailable = false }, 'missing-native-calibration')
  issue((run) => { run.report.stages.at(-1).nativeElapsedMs.max = 500 }, 'invalid-editable-clock-bounds')
  issue((run) => { run.report.stages[0].nativeElapsedMs.min = 0 }, 'inconsistent-clock-projection')
  issue((run) => { run.report.editor.open.stages.reverse() }, 'invalid-editor-stage-order')
  issue((run) => { run.report.native.sampledAtElapsedMs = 100 }, 'invalid-native-timeline')
  issue((run) => { run.report.native.stages[4].windowLabel = 'another-window' }, 'invalid-native-timeline')
  issue((run) => { run.report.native.stages.splice(2, 1) }, 'missing-native-stages')
  issue((run) => { run.report.stages.at(-1).name = 'mf:startup:interactive-error' }, 'missing-editable-outcome')
  issue((run) => { run.report.stages.at(-1).name = 'mf:boot-shell-first-frame' }, 'missing-editable-outcome')
  issue((run) => { run.report.stages.push({ name: 3 }) }, 'invalid-webview-timeline')
  const value = input()
  for (const run of value.cases[0].runs) run.report.native.stages.pop()
  assert.equal(first(value).recordedTimingGatePassed, true, 'page load may still be pending when content becomes editable')
})

test('uses the conservative startup bound and includes slow samples in percentiles', () => {
  const value = input()
  const runs = value.cases[0].runs
  runs[28].launchToNativeEntryMs = { min: 10, max: 610 }
  assert.equal(first(value).launchToEditableMs.upper.p95, 420)
  assert.equal(first(value).launchToEditableMs.upper.max, 1010)
  runs[29].launchToNativeEntryMs = { min: 10, max: 610 }
  assert.equal(first(value).launchToEditableMs.lower.p95, 400)
  assert.equal(first(value).launchToEditableMs.upper.p95, 1010)
  assert.ok(first(value).reasons.includes('startup-upper-p95-over-1000ms'))
  for (const run of runs.slice(-2)) {
    run.report.editor.firstInputFeedbackMs = 51
    run.report.editor.open.firstInputDuration = 51
  }
  assert.ok(first(value).reasons.includes('input-feedback-p95-over-50ms'))
})

test('does not pool warm, reload, reboot, large-document or stress cases into 200 KiB cold startup', () => {
  for (const options of [
    { launchKind: 'warm-window' }, { launchKind: 'reload' }, { launchKind: 'os-reboot' },
    { byteLength: 2 * 1024 * 1024 }, { fixture: 'long-code' },
  ]) {
    const value = input([makeCase(options)])
    const result = reportStartupPerformance(value)
    assert.equal(result.recordedTimingGatePassed, false)
    assert.equal(result.cases[0].recordedTimingGatePassed, null)
    assert.equal(result.cases[0].validRuns, 30)
    assert.equal(result.missingCases.length, 7)
    if (['warm-window', 'reload'].includes(options.launchKind)) assert.equal(result.cases[0].launchToEditableMs.upper, null)
  }
})

test('requires artifact/environment declarations, session setup, and distinct case identities', () => {
  const value = input()
  value.environment.engine = 'happy-dom'
  delete value.artifact.hostBinarySha256
  delete value.cases[0].setup
  const result = first(value)
  assert.ok(result.reasons.includes('missing-native-environment-declaration'))
  assert.ok(result.reasons.includes('missing-artifact-declaration'))
  assert.ok(result.reasons.includes('local-files-not-declared'))
  for (const [scenario, reason] of [['restored-tabs', 'fewer-than-20-restored-tabs'], ['hidden-drafts', 'fewer-than-20-hidden-drafts'], ['split-panes', 'not-two-split-panes']]) {
    const entry = makeCase({ scenario, setup: { localFiles: true } })
    assert.ok(first(input([entry])).reasons.includes(reason))
  }
  assert.equal(reportStartupPerformance(input([makeCase(), makeCase()])).duplicateCases.length, 1)
  assert.throws(() => reportStartupPerformance({ cases: [] }), /schemaVersion/)
  assert.throws(() => reportStartupPerformance(input([{ fixture: 'unknown' }])), /Every case/)
})
