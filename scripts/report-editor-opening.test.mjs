import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import {
  createEditorOpeningFixture,
  EDITOR_OPENING_FIXTURES,
} from '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts'
import { reportEditorOpening } from './report-editor-opening.mjs'

let openSequence = 0
const OPEN_STAGES = [
  'requested',
  'type-ready',
  'host-content-start',
  'cache-ready',
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
const sample = () => ({
  openRequestId: `open-${++openSequence}`,
  fileId: 'file',
  viewId: 'pane',
  origin: 'command',
  kind: 'open',
  mode: 'wysiwyg',
  status: 'ready',
  byteLength: 2_097_152,
  blockCount: 42,
  duration: 500,
  contentRevision: 1,
  firstInputDuration: 16,
  runtimeVersion: 'fixture-version',
  runtimeEntrySha256: 'a'.repeat(64),
  moduleState: 'warm',
  stages: OPEN_STAGES.map((stage, index) => ({
    stage,
    elapsedMs: stage === 'ready' ? 500 : stage === 'content-measured' ? 501 : index,
  })),
})
const fixtureSha256 = (fixture) =>
  createHash('sha256').update(createEditorOpeningFixture(fixture)).digest('hex')
const oneCase = () => ({
  fixture: 'mixed-ordinary',
  fixtureSha256: fixtureSha256('mixed-ordinary'),
  scenario: 'warm-open',
  opens: Array.from({ length: 30 }, sample),
})
const report = (entry) => reportEditorOpening({ cases: [entry] })
const completeInput = () => {
  const input = {
    environment: {
      engine: 'tauri-webview',
      device: 'M1 Pro 16 GiB',
      runtimeTarballSha256: 'b'.repeat(64),
    },
    cases: [],
  }
  for (const [fixture, info] of Object.entries(EDITOR_OPENING_FIXTURES)) {
    if (info.stress) continue
    for (const scenario of ['module-first', 'warm-open', 'switch']) {
      const entry = oneCase()
      entry.fixture = fixture
      entry.fixtureSha256 = fixtureSha256(fixture)
      entry.scenario = scenario
      for (const row of entry.opens) {
        row.moduleState = scenario === 'module-first' ? 'cold' : 'warm'
        if (scenario === 'switch') {
          row.kind = 'switch'
          row.duration = 32
          row.stages.find((stage) => stage.stage === 'ready').elapsedMs = 32
          row.stages.find((stage) => stage.stage === 'content-measured').elapsedMs = 33
        }
      }
      input.cases.push(entry)
    }
  }
  return input
}

test('reports per-case percentiles but does not call a partial simulated run accepted', () => {
  const result = report(oneCase())
  assert.equal(result.ordinaryTimingGatePassed, false)
  assert.equal(result.cases[0].passed, true)
  assert.deepEqual(result.cases[0].opening, { samples: 30, p50: 500, p95: 500, max: 500 })
  assert.ok(result.missingCases.includes('mixed-ordinary:module-first'))
})

test('retains failures and slow first-use samples instead of filtering them out', () => {
  const entry = oneCase()
  entry.opens[0].duration = 2_000
  entry.opens[1].duration = 1_500
  entry.opens[2].status = 'canceled'
  const result = report(entry).cases[0]
  assert.equal(result.passed, false)
  assert.equal(result.statuses.canceled, 1)
  assert.equal(result.opening.p95, 1_500)
  assert.equal(result.opening.max, 2_000)
  assert.ok(result.reasons.includes('incomplete-or-failed-runs-retained'))
})

test('rejects misleading identities, mixed scenarios, missing first-input proof and sparse samples', () => {
  const entry = oneCase()
  entry.opens[0].moduleState = 'cold'
  entry.opens[1].runtimeVersion = 'different'
  delete entry.opens[2].firstInputDuration
  entry.opens[3].origin = 'mount'
  entry.opens.pop()
  const result = report(entry).cases[0]
  for (const reason of [
    'fewer-than-30-runs',
    'missing-command-start',
    'mixed-runtime-versions',
    'missing-or-mixed-module-state',
    'fewer-than-30-first-inputs',
  ]) {
    assert.ok(result.reasons.includes(reason), reason)
  }
})

test('rejects missing, duplicate, or revisionless opening identities', () => {
  const entry = oneCase()
  entry.opens[0].openRequestId = ''
  entry.opens[1].openRequestId = entry.opens[2].openRequestId
  delete entry.opens[3].contentRevision
  entry.opens[4].contentRevision = -1
  const result = report(entry).cases[0]
  for (const reason of [
    'missing-open-request-id',
    'duplicate-open-request-id',
    'missing-content-revision',
  ]) {
    assert.ok(result.reasons.includes(reason), reason)
  }
})

test('requires file identity, exact bytes, block counts and complete timed stages', () => {
  const entry = oneCase()
  entry.fixtureSha256 = '0'.repeat(64)
  entry.opens[0].fileId = ''
  entry.opens[1].byteLength = 2_097_151
  delete entry.opens[2].blockCount
  entry.opens[3].stages = entry.opens[3].stages.filter((stage) => stage.stage !== 'parse')
  entry.opens[4].stages[0].elapsedMs = Number.NaN
  entry.opens[5].stages = [
    ...entry.opens[5].stages.slice(0, -3),
    entry.opens[5].stages.at(-2),
    entry.opens[5].stages.at(-3),
    entry.opens[5].stages.at(-1),
  ]
  const result = report(entry).cases[0]
  for (const reason of [
    'missing-file-or-view-identity',
    'fixture-sha-mismatch',
    'not-exactly-2-MiB',
    'missing-block-count',
    'missing-required-stages',
    'invalid-stage-timing',
    'invalid-stage-order',
  ]) {
    assert.ok(result.reasons.includes(reason), reason)
  }
})

test('requires the retained switch surface stages and exact fixture bytes', () => {
  const entry = oneCase()
  entry.scenario = 'switch'
  for (const row of entry.opens) {
    row.kind = 'switch'
    row.duration = 32
    row.stages.find((stage) => stage.stage === 'ready').elapsedMs = 32
    row.stages.find((stage) => stage.stage === 'content-measured').elapsedMs = 33
  }
  entry.opens[0].byteLength = undefined
  entry.opens[1].stages = entry.opens[1].stages.filter(
    (stage) => stage.stage !== 'surface-committed',
  )
  const result = report(entry).cases[0]
  assert.ok(result.reasons.includes('not-exactly-2-MiB'))
  assert.ok(result.reasons.includes('missing-required-stages'))
  assert.ok(!result.reasons.includes('missing-block-count'))
})

test('requires every ordinary fixture and scenario plus declared real WebView identity', () => {
  const input = completeInput()
  assert.equal(reportEditorOpening(input).ordinaryTimingGatePassed, true)
  input.environment.engine = 'happy-dom'
  assert.equal(reportEditorOpening(input).ordinaryTimingGatePassed, false)
})

test('rejects duplicate cases and runtime identities mixed across cases', () => {
  const input = completeInput()
  const mixedCase = input.cases[1]
  for (const row of mixedCase.opens) {
    row.runtimeVersion = 'other-version'
    row.runtimeEntrySha256 = 'c'.repeat(64)
  }
  input.cases[2].opens[0].openRequestId = input.cases[3].opens[0].openRequestId
  const duplicateCase = structuredClone(input.cases[0])
  for (const [index, row] of duplicateCase.opens.entries()) row.openRequestId = `duplicate-${index}`
  input.cases.push(duplicateCase)

  const result = reportEditorOpening(input)
  assert.equal(result.runtimeIdentityConsistent, false)
  assert.deepEqual(result.duplicateCases, [`${input.cases[0].fixture}:${input.cases[0].scenario}`])
  assert.deepEqual(result.duplicateOpenRequestIds, [input.cases[3].opens[0].openRequestId])
  assert.equal(result.ordinaryTimingGatePassed, false)
})

test('keeps extreme structures out of a false ordinary timing claim', () => {
  const entry = oneCase()
  entry.fixture = 'long-paragraph'
  entry.fixtureSha256 = fixtureSha256('long-paragraph')
  const result = report(entry).cases[0]
  assert.equal(result.stress, true)
  assert.equal(result.passed, false)
  assert.match(result.reasons.join(' '), /stress-responsiveness/)
})
