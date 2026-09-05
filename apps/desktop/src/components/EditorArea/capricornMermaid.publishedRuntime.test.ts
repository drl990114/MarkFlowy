// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import type { CapricornRuntimeFactory, CapricornRuntimeSession } from './capricornRuntimeAdapter'

let session: CapricornRuntimeSession | undefined
class Observer {
  observe() {}
  unobserve() {}
  disconnect() {}
}
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', Observer)
  vi.stubGlobal('IntersectionObserver', Observer)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('CSSStyleSheet', window.CSSStyleSheet)
})
afterEach(() => {
  act(() => session?.destroy())
  session = undefined
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

describe.skipIf(!isCapricornRuntimeAvailable)('published Capricorn Mermaid runtime', () => {
  it('loads the installed Mermaid flowchart layout and renders Chinese labels', async () => {
    const descriptors = new Map(
      ['getBBox', 'getComputedTextLength'].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(SVGElement.prototype, key),
      ]),
    )
    // JSDOM has no text geometry. Keep the packaged parser/layout/rendering real.
    Object.defineProperties(SVGElement.prototype, {
      getBBox: { configurable: true, value: () => ({ x: 0, y: 0, width: 120, height: 24 }) },
      getComputedTextLength: { configurable: true, value: () => 120 },
    })
    const container = document.createElement('div')
    document.body.append(container)
    try {
      await act(async () => {
        session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
          markdown: '```mermaid\nflowchart LR\n A["中文起点"] --> B["中文终点"]\n```',
          mode: 'preview',
        })
      })
      await waitFor(
        () => {
          const preview = container.querySelector('[data-mermaid-preview]')
          expect(preview?.textContent).not.toMatch(/not registered|Unknown layout algorithm/)
          expect(preview?.getAttribute('data-mermaid-preview')).toBe('ready')
        },
        { timeout: 15_000 },
      )
      expect(container.querySelectorAll('[data-mermaid-preview] .node')).toHaveLength(2)
      expect(container.textContent).toContain('中文起点')
      expect(container.textContent).toContain('中文终点')
    } finally {
      act(() => session?.destroy())
      session = undefined
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(SVGElement.prototype, key, descriptor)
        else Reflect.deleteProperty(SVGElement.prototype, key)
      }
    }
  })
})
