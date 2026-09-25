import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  createEditorOpeningFixture,
  EDITOR_OPENING_FIXTURES,
  summarizeOpeningDurations,
} from '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts'

const STARTUP_BYTES = 200 * 1024
const LAUNCH_KINDS = ['process-cold', 'warm-window', 'reload', 'os-reboot']
const SCENARIOS = ['single-document', 'restored-tabs', 'hidden-drafts', 'split-panes']
const REQUIRED_CASES = [
  'single-document:paragraph', 'single-document:mixed-ordinary',
  'single-document:cjk', 'single-document:tables',
  'restored-tabs:mixed-ordinary', 'hidden-drafts:mixed-ordinary', 'split-panes:mixed-ordinary',
]
const GLOBAL_STAGES = ['native-entry', 'context-ready', 'setup-start', 'configuration-ready', 'setup-end']
const WINDOW_STAGES = ['window-start', 'window-bootstrap-ready', 'webview-build-start', 'window-built', 'page-load-start']
const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const identity = (value) => typeof value === 'string' && value.trim().length > 0
const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const interval = (value) => value && finite(value.min) && finite(value.max) && value.min <= value.max
const summarize = (values) => values.length ? summarizeOpeningDurations(values) : null
const ordered = (values) => values.every((value, index) => finite(value) && (index === 0 || value >= values[index - 1]))
const caseKey = (entry) => `${entry.launchKind}:${entry.scenario}:${entry.fixture}:${entry.byteLength}`

function duplicated(values) {
  const counts = new Map()
  for (const value of values.filter(identity)) counts.set(value, (counts.get(value) ?? 0) + 1)
  return new Set([...counts].filter(([, count]) => count > 1).map(([value]) => value))
}

/** Validate recorded evidence; environment and artifact declarations are not attested by this tool. */
export function reportStartupPerformance(input) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.cases))
    throw new TypeError('Expected schemaVersion: 1 and a cases array')
  for (const entry of input.cases) {
    if (!entry || !Object.hasOwn(EDITOR_OPENING_FIXTURES, entry.fixture) ||
        !SCENARIOS.includes(entry.scenario) || !LAUNCH_KINDS.includes(entry.launchKind) ||
        !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 1 || entry.byteLength > 64 * 1024 * 1024 ||
        !Array.isArray(entry.runs))
      throw new TypeError('Every case needs a known fixture/scenario/launchKind, byteLength (1..64 MiB), and runs')
  }
  const environment = input.environment ?? {}
  const artifact = input.artifact ?? {}
  const evidenceIssues = []
  if (environment.engine !== 'tauri-webview' || !identity(environment.device) || !identity(environment.os))
    evidenceIssues.push('missing-native-environment-declaration')
  if (!identity(artifact.hostVersion) || !identity(artifact.runtimeVersion) ||
      !['hostBinarySha256', 'runtimeEntrySha256', 'runtimeTarballSha256'].every((key) => sha256(artifact[key])))
    evidenceIssues.push('missing-artifact-declaration')

  const allRuns = input.cases.flatMap((entry) => entry.runs)
  const duplicateRuns = duplicated(allRuns.map((run) => run?.runId))
  const duplicateOpens = duplicated(allRuns.map((run) => run?.report?.editor?.open?.openRequestId))
  const duplicateNavigations = duplicated(allRuns.map((run) => {
    const report = run?.report
    return report && `${report.native?.processSessionId}:${report.windowLabel}:${report.timeOrigin}`
  }))
  const duplicateProcesses = duplicated(input.cases
    .filter((entry) => ['process-cold', 'os-reboot'].includes(entry.launchKind))
    .flatMap((entry) => entry.runs.map((run) => run?.report?.native?.processSessionId)))
  const duplicateCases = [...duplicated(input.cases.map(caseKey))]
  if (duplicateCases.length) evidenceIssues.push('duplicate-cases')

  const cases = input.cases.map((entry) => {
    const cold = ['process-cold', 'os-reboot'].includes(entry.launchKind)
    const target = entry.launchKind === 'process-cold' && entry.byteLength === STARTUP_BYTES &&
      !EDITOR_OPENING_FIXTURES[entry.fixture].stress
    const fixtureHash = createHash('sha256').update(createEditorOpeningFixture(entry.fixture, entry.byteLength)).digest('hex')
    const rows = entry.runs.map((run, index) => {
      const reasons = []
      const check = (condition, reason) => { if (!condition) reasons.push(reason) }
      check(identity(run?.runId), 'missing-run-id')
      check(!duplicateRuns.has(run?.runId), 'duplicate-run-id')
      check(run?.status === 'completed', 'incomplete-or-failed-run')
      const report = run?.report
      if (!report || report.schemaVersion !== 1) return {
        runId: run?.runId ?? `missing-${index + 1}`, reasons: [...reasons, 'missing-startup-report'],
      }
      const native = report.native ?? {}
      const open = report.editor?.open ?? {}
      const context = report.editor?.context ?? {}
      check(report.buildKind === 'production' && native.buildKind === 'release', 'not-release-build')
      check(report.hostVersion === artifact.hostVersion && native.hostVersion === artifact.hostVersion &&
        report.runtime?.version === artifact.runtimeVersion && open.runtimeVersion === artifact.runtimeVersion &&
        report.runtime?.entrySha256 === artifact.runtimeEntrySha256 && open.runtimeEntrySha256 === artifact.runtimeEntrySha256,
      'artifact-identity-mismatch')
      check(identity(native.processSessionId) && identity(report.windowLabel), 'missing-native-identity')
      check(!cold || !duplicateProcesses.has(native.processSessionId), 'reused-cold-process')
      check(finite(report.timeOrigin) && report.timeOrigin > 0 &&
        !duplicateNavigations.has(`${native.processSessionId}:${report.windowLabel}:${report.timeOrigin}`),
      'missing-or-duplicate-navigation')
      check(report.navigationType === (entry.launchKind === 'reload' ? 'reload' : 'navigate'), 'wrong-navigation-kind')
      check(report.nativeClockAvailable === true && finite(report.calibrationRoundTripMs), 'missing-native-calibration')
      check(report.editor?.detailedDiagnosticsEnabled === true, 'missing-editor-diagnostics')
      check(identity(open.openRequestId) && !duplicateOpens.has(open.openRequestId) &&
        identity(open.fileId) && identity(open.viewId) &&
        context.openRequestId === open.openRequestId && context.fileId === open.fileId && context.viewId === open.viewId,
      'missing-or-mismatched-editor-identity')
      check(context.mode === 'wysiwyg' && open.mode === 'wysiwyg', 'not-wysiwyg')
      check(open.status === 'ready' && open.kind === 'open' && finite(open.duration), 'editor-not-ready')
      check(Number.isSafeInteger(open.contentRevision) && open.contentRevision >= 0, 'missing-content-revision')
      check(open.byteLength === entry.byteLength && open.contentSha256 === fixtureHash, 'initial-content-mismatch')
      const openStages = Array.isArray(open.stages) ? open.stages : []
      const requiredOpenStages = ['runtime-ready', 'surface-committed', 'ready', 'content-measured']
      check(requiredOpenStages.every((name) => openStages.some((stage) => stage?.stage === name && finite(stage.elapsedMs))), 'missing-editor-stages')
      check(ordered(openStages.map((stage) => stage?.elapsedMs)) &&
        ordered(requiredOpenStages.map((name) => openStages.findIndex((stage) => stage?.stage === name))) &&
        openStages.some((stage) => stage?.stage === 'ready' && stage.elapsedMs === open.duration), 'invalid-editor-stage-order')
      check(open.firstInputTrusted === true && finite(open.firstInputDuration) &&
        report.editor?.firstInputFeedbackMs === open.firstInputDuration, 'missing-trusted-first-input-feedback')

      const nativeStages = Array.isArray(native.stages) ? native.stages : []
      const nativeStage = (name) => nativeStages.find((stage) => stage?.name === name)
      check(finite(native.sampledAtElapsedMs) && nativeStages.length > 0 &&
        ordered(nativeStages.map((stage) => stage?.elapsedMs)) &&
        nativeStages.every((stage) => identity(stage?.name) && stage.elapsedMs <= native.sampledAtElapsedMs &&
          (!stage.windowLabel || stage.windowLabel === report.windowLabel)) &&
        new Set(nativeStages.map((stage) => stage?.name)).size === nativeStages.length,
      'invalid-native-timeline')
      check(GLOBAL_STAGES.every((name) => nativeStage(name) && !nativeStage(name).windowLabel) &&
        WINDOW_STAGES.every((name) => nativeStage(name)?.windowLabel === report.windowLabel) &&
        nativeStage('native-entry')?.elapsedMs === 0, 'missing-native-stages')
      check(ordered(GLOBAL_STAGES.map((name) => nativeStage(name)?.elapsedMs)) &&
        ordered(WINDOW_STAGES.slice(0, 4).map((name) => nativeStage(name)?.elapsedMs)) &&
        (!nativeStage('page-load-finished') || ordered(['page-load-start', 'page-load-finished'].map((name) => nativeStage(name)?.elapsedMs))),
      'invalid-native-stage-order')

      const stages = Array.isArray(report.stages) ? report.stages : []
      const interactive = stages.filter((stage) => typeof stage?.name === 'string' && stage.name.startsWith('mf:startup:interactive-'))
      const ready = interactive[0]
      check(interactive.length === 1 && ready?.name === 'mf:startup:interactive-editable', 'missing-editable-outcome')
      check(stages.some((stage) => stage?.name === 'mf:startup:webview-start' && stage.navigationElapsedMs === 0) &&
        stages.some((stage) => stage?.name === 'mf:startup:entry-modules-ready') &&
        ordered(stages.map((stage) => stage?.navigationElapsedMs)) &&
        stages.every((stage) => identity(stage?.name) && interval(stage.nativeElapsedMs)), 'invalid-webview-timeline')
      const nativeReady = ready?.nativeElapsedMs
      check(interval(nativeReady) && nativeReady.max - nativeReady.min <= report.calibrationRoundTripMs + 0.01 &&
        nativeReady.min <= native.sampledAtElapsedMs && nativeStage('window-built')?.elapsedMs <= nativeReady.max,
      'invalid-editable-clock-bounds')
      check(interval(nativeReady) && stages.every((stage) => interval(stage?.nativeElapsedMs) &&
        ['min', 'max'].every((edge) => Math.abs(stage.nativeElapsedMs[edge] - Math.max(0,
          nativeReady[edge] + stage.navigationElapsedMs - ready.navigationElapsedMs)) < 0.01)), 'inconsistent-clock-projection')
      check(!cold || interval(run.launchToNativeEntryMs), 'missing-launch-to-native-entry-bounds')
      const launch = cold && interval(run.launchToNativeEntryMs) && interval(nativeReady)
        ? { min: run.launchToNativeEntryMs.min + nativeReady.min, max: run.launchToNativeEntryMs.max + nativeReady.max }
        : undefined
      return {
        runId: run.runId, reasons,
        launchToEditableMs: launch,
        navigationToEditableMs: ready?.navigationElapsedMs,
        firstInputFeedbackMs: open.firstInputDuration,
      }
    })
    // Invalid rows remain visible and invalidate a gate, even if 30 other rows pass.
    const valid = rows.filter((row) => row.reasons.length === 0)
    const launchToEditableMs = {
      lower: summarize(valid.map((row) => row.launchToEditableMs?.min).filter(finite)),
      upper: summarize(valid.map((row) => row.launchToEditableMs?.max).filter(finite)),
    }
    const firstInputFeedbackMs = summarize(valid.map((row) => row.firstInputFeedbackMs))
    const reasons = [...evidenceIssues]
    if (entry.runs.length < 30) reasons.push('fewer-than-30-runs')
    if (valid.length !== entry.runs.length) reasons.push('invalid-or-failed-runs-retained')
    if (!valid.length) reasons.push('no-valid-runs')
    if (entry.setup?.localFiles !== true) reasons.push('local-files-not-declared')
    if (entry.scenario === 'restored-tabs' && !(entry.setup?.restoredTabs >= 20)) reasons.push('fewer-than-20-restored-tabs')
    if (entry.scenario === 'hidden-drafts' && !(entry.setup?.hiddenDrafts >= 20)) reasons.push('fewer-than-20-hidden-drafts')
    if (entry.scenario === 'split-panes' && entry.setup?.panes !== 2) reasons.push('not-two-split-panes')
    if (target && launchToEditableMs.upper?.p95 > 1000) reasons.push('startup-upper-p95-over-1000ms')
    if (target && firstInputFeedbackMs?.p95 > 50) reasons.push('input-feedback-p95-over-50ms')
    return {
      key: caseKey(entry), scenario: entry.scenario, fixture: entry.fixture,
      byteLength: entry.byteLength, launchKind: entry.launchKind,
      target, runs: rows.length, validRuns: valid.length,
      launchToEditableMs, navigationToEditableMs: summarize(valid.map((row) => row.navigationToEditableMs)),
      firstInputFeedbackMs, reasons, invalidRuns: rows.filter((row) => row.reasons.length),
      recordedTimingGatePassed: target ? reasons.length === 0 : null,
    }
  })
  const missingCases = REQUIRED_CASES.filter((key) => !cases.some((entry) =>
    entry.target && `${entry.scenario}:${entry.fixture}` === key))
  return {
    schemaVersion: 1, environment, artifact,
    scope: 'Recorded Capricorn WYSIWYG process-cold 200 KiB timing only. DOM mutation to the next animation frame is an input-feedback proxy, not physical display latency. Native visual/IME, recovery durability, and declared setup/artifact verification remain separate.',
    environmentVerifiedByTool: false,
    evidenceIssues, duplicateCases, missingCases, cases,
    recordedTimingGatePassed: !evidenceIssues.length && !missingCases.length &&
      cases.filter((entry) => entry.target).every((entry) => entry.recordedTimingGatePassed),
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/report-startup-performance.mjs /absolute/path/to/cases.json')
  const report = reportStartupPerformance(JSON.parse(await readFile(process.argv[2], 'utf8')))
  console.log(JSON.stringify(report, null, 2))
  if (!report.recordedTimingGatePassed) process.exitCode = 1
}
