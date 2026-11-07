// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'

const editors: CapricornRuntimeAdapter[] = []
const observers = new Set<TestResizeObserver>()
class TestResizeObserver implements ResizeObserver {
  targets = new Set<Element>()

  constructor(readonly callback: ResizeObserverCallback) {
    observers.add(this)
  }

  observe(target: Element) {
    this.targets.add(target)
  }

  unobserve(target: Element) {
    this.targets.delete(target)
  }

  disconnect() {
    this.targets.clear()
    observers.delete(this)
  }
}

// Keep the actual Mermaid renderer and installed runtime. DOM runners have no
// SVG layout, so these metrics establish sizing/event contracts, not visual fidelity.
const geometry = [
  [Range.prototype, 'getClientRects', () => []],
  [Range.prototype, 'getBoundingClientRect', () => new DOMRect()],
  [SVGElement.prototype, 'getBBox', () => ({ x: 0, y: 0, width: 120, height: 24 })],
  [SVGElement.prototype, 'getComputedTextLength', () => 120],
  [window, 'ResizeObserver', TestResizeObserver],
] as const
const descriptors = geometry.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key))

beforeAll(() => {
  geometry.forEach(([target, key, value]) => {
    Object.defineProperty(target, key, { configurable: true, writable: true, value })
  })
})

afterEach(async () => {
  await act(async () => editors.splice(0).forEach((editor) => editor.destroy()))
  document.body.replaceChildren()
  expect(observers.size).toBe(0)
})

afterAll(() => {
  geometry.forEach(([target, key], index) => {
    const descriptor = descriptors[index]
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else Reflect.deleteProperty(target, key)
  })
})

async function resize(viewport: HTMLElement, width: number) {
  Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: width })
  const observer = [...observers].find((entry) => entry.targets.has(viewport))
  expect(observer).toBeDefined()
  await act(async () => {
    observer!.callback(
      [
        {
          target: viewport,
          contentRect: new DOMRect(0, 0, width, 400),
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        },
      ],
      observer!,
    )
  })
}

it('automatically sizes Mermaid without controls, document edits or SVG remounts', async () => {
  const markdown = '```mermaid\nflowchart LR\n A["中文起点"] --> B["中文终点"]\n```'
  const container = document.createElement('div')
  document.body.append(container)
  const changes = vi.fn()
  const errors = vi.fn()
  let editor!: CapricornRuntimeAdapter
  await act(async () => {
    editor = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      options: { markdown, autoFocus: false, virtualize: { enable: false }, onError: errors },
      onChange: changes,
    })
  })
  editors.push(editor)
  const preview = await waitFor(
    () => {
      const element = container.querySelector<HTMLElement>('[data-mermaid-preview]')
      expect(element?.getAttribute('data-mermaid-preview'), element?.textContent).toBe('ready')
      return element!
    },
    { timeout: 15000 },
  )
  expect(preview.textContent).toContain('中文起点')
  expect(preview.querySelector('button, [role="toolbar"], [data-mermaid-sizing]')).toBeNull()
  expect(preview.hasAttribute('data-mermaid-sizing-mode')).toBe(false)
  const viewport = preview.querySelector<HTMLElement>('.capricorn-mermaid-preview-viewport')!
  const surface = preview.querySelector<HTMLElement>('.capricorn-mermaid-preview-svg')!
  const svg = surface.querySelector('svg')!
  const naturalWidth = parseFloat(surface.style.width)
  const naturalHeight = parseFloat(surface.style.height)
  expect(naturalWidth).toBeGreaterThan(0)
  expect(naturalHeight).toBeGreaterThan(0)
  changes.mockClear()

  // Small diagrams enlarge at most 1.5x; wider diagrams retain their natural
  // dimensions and the viewport owns scrolling instead of shrinking the text.
  for (const [available, scale] of [
    [2, 1.5],
    [1.25, 1.25],
    [0.5, 1],
  ]) {
    await resize(viewport, naturalWidth * available)
    expect(parseFloat(surface.style.width)).toBeCloseTo(naturalWidth * scale)
    expect(parseFloat(surface.style.height)).toBeCloseTo(naturalHeight * scale)
    expect(surface.querySelector('svg')).toBe(svg)
  }
  expect(viewport.tabIndex).toBe(0)
  const keydown = vi.fn()
  // React delegates events at the runtime mount; observe outside that root.
  document.body.addEventListener('keydown', keydown)
  const event = new KeyboardEvent('keydown', {
    key: 'ArrowRight',
    bubbles: true,
    cancelable: true,
  })
  viewport.dispatchEvent(event)
  document.body.removeEventListener('keydown', keydown)
  expect(keydown).not.toHaveBeenCalled()
  expect(event.defaultPrevented).toBe(false)
  expect(editor.getMarkdown()).toBe(markdown)
  expect(editor.getUiState().canUndo).toBe(false)
  expect(changes.mock.calls.some(([change]) => change.documentChanged)).toBe(false)
  expect(errors).not.toHaveBeenCalled()
}, 30000)
