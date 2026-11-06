// @vitest-environment jsdom
// Keep Mermaid and DOMPurify on a DOM implementation with SVG support.

import { act, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import i18n, { i18nInit } from '@/i18n'
import {
  createCapricornRuntimeAdapter,
  type CapricornLocalizationAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'

// Shared by source development and the pinned runtime integration suite.
// Geometry below makes Mermaid's real parser/renderer usable in the DOM runner;
// these assertions establish host behavior, not browser pixel readability.
const source = [
  '# 审批流程',
  '',
  '```mermaid',
  'sequenceDiagram',
  '  participant User as 用户',
  '  participant Service as 服务',
  '  User->>Service: 提交申请',
  '  Service-->>User: 返回审批结果',
  '```',
].join('\n')

const localization: CapricornLocalizationAdapter = {
  getDirection: () => (i18n.dir() === 'rtl' ? 'rtl' : 'ltr'),
  getLocale: () => i18n.resolvedLanguage || i18n.language || 'en',
  subscribe(listener) {
    i18n.on('languageChanged', listener)
    return () => i18n.off('languageChanged', listener)
  },
  translate: ({ defaultValue, key, values }) =>
    i18n.t(`capricorn.${key}`, { defaultValue, ...values }),
}

const observers = new Set<TestResizeObserver>()

function geometryPrototype(name: string): object {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
  let prototype: object | null = Object.getPrototypeOf(text)
  while (prototype) {
    if (Object.prototype.hasOwnProperty.call(prototype, name)) return prototype
    prototype = Object.getPrototypeOf(prototype)
  }
  return SVGElement.prototype
}

const geometryTargets = [
  [geometryPrototype('getBBox'), 'getBBox'],
  [geometryPrototype('getComputedTextLength'), 'getComputedTextLength'],
] as const
const geometryDescriptors = geometryTargets.map(([prototype, name]) => [
  prototype,
  name,
  Object.getOwnPropertyDescriptor(prototype, name),
] as const)

class TestResizeObserver implements ResizeObserver {
  private readonly targets = new Set<Element>()

  constructor(private readonly callback: ResizeObserverCallback) {
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

  resize(target: Element, width: number) {
    if (!this.targets.has(target)) return
    const size = [{ inlineSize: width, blockSize: 400 }]
    this.callback([
      {
        target,
        contentRect: new DOMRect(0, 0, width, 400),
        borderBoxSize: size,
        contentBoxSize: size,
        devicePixelContentBoxSize: size,
      },
    ], this)
  }
}

let adapter: CapricornRuntimeAdapter | undefined

afterEach(async () => {
  await act(async () => adapter?.destroy())
  adapter = undefined
  document.body.replaceChildren()
  observers.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const [prototype, name, descriptor] of geometryDescriptors) {
    if (descriptor) Object.defineProperty(prototype, name, descriptor)
    else Reflect.deleteProperty(prototype, name)
  }
})

async function mount(mode: 'edit' | 'preview') {
  await i18nInit({ lng: 'cn' })
  vi.stubGlobal('ResizeObserver', TestResizeObserver)
  // Supply only missing SVG geometry on the prototype that owns each method.
  Object.defineProperty(geometryTargets[0][0], 'getBBox', {
    configurable: true,
    value(this: SVGElement) {
      return new DOMRect(0, 0, Math.max(16, (this.textContent || '').length * 8), 24)
    },
  })
  Object.defineProperty(geometryTargets[1][0], 'getComputedTextLength', {
    configurable: true,
    value(this: SVGElement) {
      return Math.max(16, (this.textContent || '').length * 8)
    },
  })

  const container = document.createElement('div')
  document.body.append(container)
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 40, 800, 600))
  const onChange = vi.fn()
  const onError = vi.fn()
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      onChange,
      options: {
        markdown: source,
        autoFocus: false,
        virtualize: { enable: false },
        mode,
        localization,
        onError,
      },
    })
  })
  await waitFor(() => {
    const preview = container.querySelector('[data-mermaid-preview]')
    expect(preview?.getAttribute('data-mermaid-preview'), preview?.textContent || '').toBe('ready')
  }, { timeout: 15000 })
  onChange.mockClear()
  return { container, runtime: adapter!, onChange, onError }
}

async function resize(viewport: HTMLElement, width: number) {
  Object.defineProperty(viewport, 'clientWidth', { configurable: true, value: width })
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, width, 400))
  await act(async () => {
    for (const observer of observers) observer.resize(viewport, width)
  })
}

describe('Capricorn Mermaid sizing in MarkFlowy', () => {
  it.each([
    ['en', ['Readable size', 'Fit width', 'Actual size (100%)', 'Diagram size']],
    ['cn', ['可读尺寸', '适应宽度', '原始尺寸（100%）', '图表尺寸']],
    ['frFR', ['Taille lisible', 'Ajuster à la largeur', 'Taille réelle (100 %)', 'Taille du diagramme']],
    ['es', ['Tamaño legible', 'Ajustar al ancho', 'Tamaño real (100 %)', 'Tamaño del diagrama']],
    ['ja', ['読みやすいサイズ', '幅に合わせる', '実際のサイズ（100%）', '図のサイズ']],
  ] as const)('loads sizing labels for %s without a fallback', async (language, labels) => {
    await i18nInit({ lng: language })
    for (const [index, key] of ['autoSize', 'fitWidth', 'actualSize', 'size'].entries()) {
      const translationKey = `capricorn.preview.mermaid.${key}`
      expect(i18n.getResource(language, 'translation', translationKey)).toBe(labels[index])
      expect(i18n.t(translationKey, { defaultValue: 'Missing translation' })).toBe(labels[index])
    }
  })

  it.each(['edit', 'preview'] as const)(
    'sizes a real Chinese sequence diagram in %s without editing source or history',
    async (mode) => {
      const { container, runtime, onChange, onError } = await mount(mode)
      const preview = container.querySelector<HTMLElement>('[data-mermaid-preview="ready"]')!
      const viewport = preview.querySelector<HTMLElement>('.capricorn-mermaid-preview-viewport')!
      const canvas = preview.querySelector<HTMLElement>('.capricorn-mermaid-preview-svg')!
      const svg = canvas.querySelector('svg')!
      const block = preview.closest('[data-live-preview-kind="mermaid"]')!
      const initialHistory = runtime.getUiState().canUndo
      const initialMarkdown = runtime.getMarkdown()
      const button = (sizing: string) =>
        preview.querySelector<HTMLButtonElement>(`button[data-mermaid-sizing="${sizing}"]`)!

      expect(preview.getAttribute('role')).toBe('group')
      expect(canvas.getAttribute('role')).toBe('img')
      expect(svg, canvas.innerHTML).not.toBeNull()
      expect(svg.querySelector('.messageText')?.textContent).toContain('提交申请')
      expect(svg.textContent).toContain('返回审批结果')
      expect(preview.getAttribute('data-mermaid-sizing-mode')).toBe('auto')
      expect(button('auto').textContent).toBe('可读尺寸')
      expect(button('auto').getAttribute('aria-pressed')).toBe('true')
      expect(button('fit').textContent).toBe('适应宽度')
      expect(button('actual').textContent).toBe('原始尺寸（100%）')
      expect(button('auto').parentElement?.getAttribute('role')).toBe('group')
      expect(button('auto').parentElement?.getAttribute('aria-label')).toBe('图表尺寸')

      await resize(viewport, 720)
      const readableWidth = Number.parseFloat(canvas.style.width)
      expect(readableWidth).toBeGreaterThan(0)

      await act(async () => {
        fireEvent.pointerDown(button('fit'), { button: 0, pointerType: 'mouse' })
        fireEvent.mouseDown(button('fit'), { button: 0 })
        fireEvent.click(button('fit'))
      })
      expect(preview.getAttribute('data-mermaid-sizing-mode')).toBe('fit')
      expect(button('fit').getAttribute('aria-pressed')).toBe('true')
      expect(button('auto').getAttribute('aria-pressed')).toBe('false')
      expect(Number.parseFloat(canvas.style.width)).toBe(720)

      await resize(viewport, 440)
      expect(Number.parseFloat(canvas.style.width)).toBe(440)
      await act(async () => fireEvent.click(button('actual')))
      expect(preview.getAttribute('data-mermaid-sizing-mode')).toBe('actual')
      expect(button('actual').getAttribute('aria-pressed')).toBe('true')
      const actualWidth = Number.parseFloat(canvas.style.width)
      expect(actualWidth).toBeGreaterThan(0)
      expect(readableWidth).toBeGreaterThanOrEqual(actualWidth)
      expect(readableWidth).toBeLessThanOrEqual(actualWidth * 1.5 + 0.01)
      await resize(viewport, 320)
      expect(Number.parseFloat(canvas.style.width)).toBe(actualWidth)

      expect(canvas.querySelector('svg')).toBe(svg)
      expect(block.getAttribute('data-live-preview-layout')).toBe('preview')
      expect(runtime.getMarkdown()).toBe(initialMarkdown)
      expect(initialMarkdown).toBe(source)
      expect(runtime.getUiState().canUndo).toBe(initialHistory)
      expect(onChange.mock.calls.every(([event]) => !event?.documentChanged)).toBe(true)
      expect(onError).not.toHaveBeenCalled()
    },
    30000,
  )
})
