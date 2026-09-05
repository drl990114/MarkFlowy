import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  createEditorOpeningFixture,
  EDITOR_OPENING_FIXTURES,
  EDITOR_OPENING_FIXTURE_BYTES,
  summarizeOpeningDurations,
} from '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts'

const SCENARIOS = ['module-first', 'warm-open', 'switch']
const OPEN_REQUIRED_STAGES = [
  'requested',
  'type-ready',
  'host-content-start',
  'content-ready',
  'host-content-ready',
  'module-ready',
  'queued',
  'parse',
  'transfer',
  'hydrate',
  'model',
  'index',
  'mount',
  'runtime-ready',
  'surface-committed',
  'ready',
  'content-measured',
]
const SWITCH_REQUIRED_STAGES = [
  'requested',
  'runtime-ready',
  'surface-committed',
  'ready',
  'content-measured',
]
const finite = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const summarize = (values) => (values.length ? summarizeOpeningDurations(values) : null)
const validIdentity = (value) => typeof value === 'string' && value.trim().length > 0
const fixtureSha256 = (fixture) =>
  createHash('sha256').update(createEditorOpeningFixture(fixture)).digest('hex')

function invalidStageTiming(stage) {
  if (!stage || !validIdentity(stage.stage) || !finite(stage.elapsedMs)) return true
  return ['latestElapsedMs', 'runtimeElapsedMs', 'durationMs'].some(
    (field) => stage[field] !== undefined && !finite(stage[field]),
  )
}

/** Never silently omit failed/canceled/cold runs from a timing gate. */
export function reportEditorOpening(input) {
  if (!input || !Array.isArray(input.cases))
    throw new TypeError('Expected environment and cases in the exported report')
  const environment = input.environment ?? {}
  const cases = input.cases.map((entry) => {
    if (
      !Object.hasOwn(EDITOR_OPENING_FIXTURES, entry.fixture) ||
      !SCENARIOS.includes(entry.scenario) ||
      !Array.isArray(entry.opens)
    ) {
      throw new TypeError('Every case requires a known fixture, scenario, and opens array')
    }
    const stress = EDITOR_OPENING_FIXTURES[entry.fixture].stress
    const samples = entry.opens
    const reasons = []
    const statuses = {}
    if (entry.fixtureSha256 !== fixtureSha256(entry.fixture)) reasons.push('fixture-sha-mismatch')
    for (const sample of samples)
      statuses[sample.status ?? 'missing'] = (statuses[sample.status ?? 'missing'] ?? 0) + 1
    const ready = samples.filter((sample) => sample.status === 'ready' && finite(sample.duration))
    if (samples.length < 30) reasons.push('fewer-than-30-runs')
    if (ready.length !== samples.length) reasons.push('incomplete-or-failed-runs-retained')
    if (samples.some((sample) => sample.origin !== 'command')) reasons.push('missing-command-start')
    if (samples.some((sample) => !validIdentity(sample.fileId) || !validIdentity(sample.viewId)))
      reasons.push('missing-file-or-view-identity')
    if (
      samples.some(
        (sample) => typeof sample.openRequestId !== 'string' || !sample.openRequestId.trim(),
      )
    )
      reasons.push('missing-open-request-id')
    if (new Set(samples.map((sample) => sample.openRequestId)).size !== samples.length)
      reasons.push('duplicate-open-request-id')
    if (
      samples.some(
        (sample) => !Number.isSafeInteger(sample.contentRevision) || sample.contentRevision < 0,
      )
    )
      reasons.push('missing-content-revision')
    if (samples.some((sample) => sample.mode !== 'wysiwyg')) reasons.push('not-wysiwyg')
    if (
      samples.some(
        (sample) =>
          !sample.runtimeVersion || !/^[a-f0-9]{64}$/i.test(sample.runtimeEntrySha256 ?? ''),
      )
    )
      reasons.push('missing-runtime-identity')
    if (
      new Set(samples.map((sample) => `${sample.runtimeVersion}:${sample.runtimeEntrySha256}`))
        .size > 1
    )
      reasons.push('mixed-runtime-versions')
    if (samples.some((sample) => sample.byteLength !== EDITOR_OPENING_FIXTURE_BYTES))
      reasons.push('not-exactly-2-MiB')
    if (
      entry.scenario !== 'switch' &&
      samples.some((sample) => !Number.isSafeInteger(sample.blockCount) || sample.blockCount < 1)
    )
      reasons.push('missing-block-count')
    if (samples.some((sample) => sample.kind !== (entry.scenario === 'switch' ? 'switch' : 'open')))
      reasons.push('mixed-open-and-switch')
    if (
      entry.scenario !== 'switch' &&
      samples.some(
        (sample) => sample.moduleState !== (entry.scenario === 'module-first' ? 'cold' : 'warm'),
      )
    )
      reasons.push('missing-or-mixed-module-state')
    const requiredStages =
      entry.scenario === 'switch' ? SWITCH_REQUIRED_STAGES : OPEN_REQUIRED_STAGES
    if (
      samples.some((sample) => {
        const stageNames = new Set(sample.stages?.map((stage) => stage.stage) ?? [])
        return (
          requiredStages.some((stage) => !stageNames.has(stage)) ||
          (entry.scenario !== 'switch' &&
            !(
              stageNames.has('cache-ready') ||
              (stageNames.has('read-start') && stageNames.has('read-end'))
            ))
        )
      })
    )
      reasons.push('missing-required-stages')
    if (
      samples.some(
        (sample) => !Array.isArray(sample.stages) || sample.stages.some(invalidStageTiming),
      )
    )
      reasons.push('invalid-stage-timing')
    if (
      samples.some((sample) => {
        const stages = sample.stages ?? []
        const runtimeReady = stages.findIndex((stage) => stage.stage === 'runtime-ready')
        const surfaceCommitted = stages.findIndex((stage) => stage.stage === 'surface-committed')
        const terminalReady = stages.findLastIndex(
          (stage) => stage.stage === 'ready' && stage.elapsedMs === sample.duration,
        )
        const contentMeasured = stages.findIndex((stage) => stage.stage === 'content-measured')
        return (
          stages[0]?.stage !== 'requested' ||
          stages[0]?.elapsedMs !== 0 ||
          runtimeReady < 0 ||
          surfaceCommitted <= runtimeReady ||
          terminalReady <= surfaceCommitted ||
          contentMeasured <= terminalReady
        )
      })
    )
      reasons.push('invalid-stage-order')
    const opening = summarize(ready.map((sample) => sample.duration))
    const inputLatencies = samples.map((sample) => sample.firstInputDuration).filter(finite)
    const firstInput = summarize(inputLatencies)
    const budgetMs = entry.scenario === 'switch' ? 100 : 1_000
    if (opening && opening.p95 > budgetMs) reasons.push('opening-p95-over-budget')
    if (inputLatencies.length < 30) reasons.push('fewer-than-30-first-inputs')
    if (firstInput && firstInput.p95 > 50) reasons.push('first-input-p95-over-budget')
    if (stress) reasons.push('stress-responsiveness-requires-separate-cancel-and-resource-checks')
    return {
      fixture: entry.fixture,
      scenario: entry.scenario,
      stress,
      runs: samples.length,
      statuses,
      opening,
      firstInput,
      budgetMs,
      passed: reasons.length === 0,
      reasons,
    }
  })
  const missingCases = Object.entries(EDITOR_OPENING_FIXTURES)
    .filter(([, fixture]) => !fixture.stress)
    .flatMap(([fixture]) =>
      SCENARIOS.filter(
        (scenario) =>
          !cases.some((entry) => entry.fixture === fixture && entry.scenario === scenario),
      ).map((scenario) => `${fixture}:${scenario}`),
    )
  const runtimeProof =
    environment.engine === 'tauri-webview' &&
    typeof environment.device === 'string' &&
    environment.device.trim().length > 0 &&
    /^[a-f0-9]{64}$/i.test(environment.runtimeTarballSha256 ?? '')
  const runtimeIdentities = [
    ...new Set(
      input.cases.flatMap((entry) =>
        Array.isArray(entry.opens)
          ? entry.opens.map(
              (sample) => `${sample.runtimeVersion ?? ''}:${sample.runtimeEntrySha256 ?? ''}`,
            )
          : [],
      ),
    ),
  ]
  const runtimeIdentityConsistent = runtimeIdentities.length === 1
  const openRequestIds = input.cases.flatMap((entry) =>
    Array.isArray(entry.opens) ? entry.opens.map((sample) => sample.openRequestId) : [],
  )
  const duplicateOpenRequestIds = [
    ...new Set(
      openRequestIds.filter((requestId, index) => openRequestIds.indexOf(requestId) !== index),
    ),
  ]
  const duplicateCases = [
    ...new Set(
      cases
        .map((entry) => `${entry.fixture}:${entry.scenario}`)
        .filter((key, index, all) => all.indexOf(key) !== index),
    ),
  ]
  return {
    environment,
    scope:
      'Recorded editable-surface and first-input samples; frame gaps are not native Long Tasks. Stress cancellation, continuous-input/IME and resource-release acceptance remain separate.',
    cases,
    missingCases,
    duplicateCases,
    duplicateOpenRequestIds,
    runtimeIdentities,
    runtimeIdentityConsistent,
    ordinaryTimingGatePassed:
      runtimeProof &&
      runtimeIdentityConsistent &&
      !missingCases.length &&
      !duplicateCases.length &&
      !duplicateOpenRequestIds.length &&
      cases.filter((entry) => !entry.stress).every((entry) => entry.passed),
    environmentVerifiedByTool: false,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (!process.argv[2])
    throw new Error('Usage: node scripts/report-editor-opening.mjs /absolute/path/to/cases.json')
  const report = reportEditorOpening(JSON.parse(await readFile(process.argv[2], 'utf8')))
  console.log(JSON.stringify(report, null, 2))
  if (!report.ordinaryTimingGatePassed) process.exitCode = 1
}
