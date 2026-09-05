import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Window } from 'happy-dom'
import {
  createEditorOpeningFixture,
  EDITOR_OPENING_FIXTURES,
  summarizeOpeningDurations,
} from '../apps/desktop/src/components/EditorArea/editorOpeningFixtures.ts'

const option = (name, fallback) => {
  const index = process.argv.indexOf(name)
  return index < 0 ? fallback : process.argv[index + 1]
}
const iterations = Number(option('--iterations', '30'))
const selected = option('--fixture', 'ordinary')
const mode = option('--mode', 'sync')
if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 1000)
  throw new Error('Use --iterations 1..1000')
if (mode !== 'sync')
  throw new Error(
    'This simulated-DOM baseline supports --mode sync only; use the browser harness for native Worker measurements.',
  )
const fixtureNames =
  selected === 'ordinary'
    ? Object.keys(EDITOR_OPENING_FIXTURES).filter((name) => !EDITOR_OPENING_FIXTURES[name].stress)
    : [selected]
if (fixtureNames.some((name) => !(name in EDITOR_OPENING_FIXTURES)))
  throw new Error('Unknown --fixture')
const runtimeRoot = resolve(
  option('--runtime', '.private-runtime/node_modules/@drl990114/capricorn-runtime'),
)
const manifest = JSON.parse(await readFile(resolve(runtimeRoot, 'package.json'), 'utf8'))
if (manifest.name !== '@drl990114/capricorn-runtime')
  throw new Error('Expected the private runtime package root')
const entry = manifest.exports?.['.']?.import
if (typeof entry !== 'string' || !entry.startsWith('./'))
  throw new Error('Missing package-root import export')
const runtimeEntry = resolve(runtimeRoot, entry)
if (!runtimeEntry.startsWith(runtimeRoot + '/'))
  throw new Error('Package entry escaped runtime root')

// Deterministic geometry exercises real module/model/React creation only. It
// deliberately does not pretend to measure Tauri I/O, WebKit layout or paint.
const window = new Window({ url: 'http://localhost' })
for (const key of [
  'window',
  'document',
  'HTMLElement',
  'Element',
  'Node',
  'Text',
  'HTMLTextAreaElement',
  'HTMLInputElement',
  'DOMParser',
  'MutationObserver',
  'Event',
  'InputEvent',
  'KeyboardEvent',
  'CustomEvent',
  'ResizeObserver',
  'IntersectionObserver',
]) {
  globalThis[key] = key === 'window' ? window : window[key]
}
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator })
globalThis.getComputedStyle = window.getComputedStyle.bind(window)
globalThis.requestAnimationFrame = window.requestAnimationFrame.bind(window)
globalThis.cancelAnimationFrame = window.cancelAnimationFrame.bind(window)
const rectangle = (height) => ({
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  right: 800,
  bottom: height,
  width: 800,
  height,
  toJSON() {
    return this
  },
})
window.HTMLElement.prototype.getBoundingClientRect = function () {
  return rectangle(this.id === 'scroller' ? 600 : 24)
}
window.Range.prototype.getBoundingClientRect = () => rectangle(24)
window.Range.prototype.getClientRects = () => [rectangle(24)]
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', {
  get() {
    return this.id === 'scroller' ? 600 : 24
  },
})
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', {
  get() {
    return 800
  },
})

try {
  const importStart = performance.now()
  const { createCapricornRuntime } = await import(pathToFileURL(runtimeEntry).href)
  console.log(
    JSON.stringify({
      environment: 'Node + happy-dom; not Tauri/paint evidence',
      version: manifest.version,
      runtimeEntrySha256: createHash('sha256')
        .update(await readFile(runtimeEntry))
        .digest('hex'),
      importMs: performance.now() - importStart,
      iterations,
    }),
  )
  for (const fixture of fixtureNames) {
    const markdown = createEditorOpeningFixture(fixture)
    const samples = []
    for (let index = 0; index < iterations; index += 1) {
      const scroller = document.createElement('div')
      scroller.id = 'scroller'
      const container = document.createElement('div')
      scroller.append(container)
      document.body.append(scroller)
      let session
      try {
        const start = performance.now()
        session = createCapricornRuntime(container, {
          markdown,
          autoFocus: false,
          colorScheme: 'light',
          getScrollableContainer: () => scroller,
          virtualize: {
            enable: true,
            firstPaintBlockSize: 40,
            bufferRange: 900,
            enableScrollAnchoring: true,
          },
        })
        samples.push(performance.now() - start)
        if (!container.querySelector('[data-cap-content]'))
          throw new Error('The runtime did not mount its document surface')
      } finally {
        session?.destroy()
        scroller.remove()
      }
      // Let destroyed controllers' queued callbacks release their captures.
      // Teardown/event-loop work is not part of the synchronous creation metric.
      await new Promise((resolveTask) => setTimeout(resolveTask, 0))
      globalThis.gc?.()
    }
    console.log(
      JSON.stringify({
        fixture,
        stress: EDITOR_OPENING_FIXTURES[fixture].stress,
        bytes: new TextEncoder().encode(markdown).byteLength,
        fixtureSha256: createHash('sha256').update(markdown).digest('hex'),
        ...summarizeOpeningDurations(samples),
        durations: samples,
      }),
    )
  }
} finally {
  await window.happyDOM.abort()
  window.close()
}
