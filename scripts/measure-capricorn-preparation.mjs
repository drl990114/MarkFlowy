// Source-level diagnostic only: excludes DOM, WebView, layout and first input.
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'
import {
  createEditorOpeningFixture,
  EDITOR_OPENING_FIXTURES,
} from '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts'

const { values } = parseArgs({
  options: {
    source: { type: 'string' },
    output: { type: 'string' },
    samples: { type: 'string', default: '5' },
    sizes: { type: 'string', default: '204800,2097152' },
  },
})
if (!values.output) throw new Error('Pass --output <JSON path>. Run with Node 24.')
const sourceRoot = path.resolve(
  values.source ?? fileURLToPath(new URL('../../capricorn', import.meta.url)),
)
const output = path.resolve(values.output)
const sampleCount = Number(values.samples)
const sizes = values.sizes.split(',').map(Number)
if (!Number.isSafeInteger(sampleCount) || sampleCount < 1)
  throw new Error('--samples must be a positive integer.')
if (!sizes.length || sizes.some((size) => !Number.isSafeInteger(size) || size < 1))
  throw new Error('--sizes must contain positive byte counts separated by commas.')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const sourceFiles = [
  'src/release/prepareDocument.ts',
  'src/release/preparationProtocol.ts',
  'src/release/preparation.worker.ts',
  'src/plugins/markdown/codec-parse.ts',
  'src/plugins/markdown/prepared-document.ts',
  'src/plugins/markdown/source-provenance.ts',
  'src/plugins/markdown/transfer-parse-model.ts',
]
const sourceSha256 = Object.fromEntries(sourceFiles.map((name) => [
  name, sha256(readFileSync(path.join(sourceRoot, name))),
]))
const fixtureSha256 = sha256(readFileSync(new URL(
  '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts', import.meta.url,
)))
const [{ SourceWorker }, { createTestServer }] = await Promise.all([
  import(pathToFileURL(path.join(sourceRoot, 'tests/helpers/source-worker.mjs')).href),
  import(pathToFileURL(path.join(sourceRoot, 'tests/helpers/vite.mjs')).href),
])
// The existing isolated source Worker harness resolves modules from this root.
process.chdir(sourceRoot)
const server = await createTestServer({ configFile: false })
const rows = []
let pool
let protocolVersion
let completed = false
try {
  const preparation = await server.ssrLoadModule('/src/release/prepareDocument.ts')
  pool = await server.ssrLoadModule('/src/release/preparationWorkerPool.ts')
  protocolVersion = (await server.ssrLoadModule('/src/release/preparationProtocol.ts'))
    .PREPARATION_PROTOCOL_VERSION
  globalThis.Worker = SourceWorker
  await pool.prewarmPreparationWorker()
  const fixtures = Object.keys(EDITOR_OPENING_FIXTURES)
    .filter((name) => !EDITOR_OPENING_FIXTURES[name].stress)
  for (const fixture of fixtures) {
    for (const bytes of sizes) {
      const markdown = createEditorOpeningFixture(fixture, bytes)
      const hash = sha256(markdown)
      for (let sample = 0; sample < sampleCount; sample++) {
        let phases = {}
        let previous = performance.now()
        let maximumTimerDelayMs = 0
        const timer = setInterval(() => {
          const now = performance.now()
          maximumTimerDelayMs = Math.max(maximumTimerDelayMs, now - previous - 5)
          previous = now
        }, 5)
        const started = performance.now()
        let value
        try {
          value = await preparation.prepareDocumentInWorker(markdown, {
            onProgress(event) {
              if (event.stage === 'parse' && event.durationMs !== undefined)
                phases.parseMs = event.durationMs
              if (event.stage === 'hydrate') phases = { ...phases, ...event }
            },
          })
        } finally {
          clearInterval(timer)
        }
        const row = {
          fixture, bytes, sha256: hash, sample,
          elapsedMs: performance.now() - started,
          blocks: value.document.nodes.length,
          maximumTimerDelayMs,
          ...phases,
        }
        rows.push(row)
        process.stdout.write(`${JSON.stringify(row)}\n`)
      }
    }
  }
  completed = true
} finally {
  pool?.disposeIdlePreparationWorker()
  await server.close()
  writeFileSync(output, JSON.stringify({
    completed,
    measuredAt: new Date().toISOString(),
    environment: 'Node24 source Worker + Vite SSR, prewarmed; excludes DOM/Tauri/layout/first-input; timer delay is a JS proxy',
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    protocolVersion,
    sourceSha256,
    fixtureSha256,
    rows,
  }, null, 2) + '\n')
}
