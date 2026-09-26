// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { resolveThemeTokens, type ResolvedTokens } from '@markflowy/theme/semantic'
import { SemanticThemeContext } from '@/themes/context'
import { CapricornEditor } from '@/components/EditorArea/CapricornEditor'
import type { CapricornRuntimeAdapter } from '@/components/EditorArea/capricornRuntimeAdapter'
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  i18n: { language: 'en', dir: () => 'ltr', on: () => {}, off: () => {}, t: (key: string) => key },
}))
afterEach(cleanup)
const rangeGeometry = ['getClientRects', 'getBoundingClientRect'].map((name) => [
  name,
  Object.getOwnPropertyDescriptor(Range.prototype, name),
] as const)
beforeAll(() => {
  // CodeMirror needs Range geometry, which jsdom does not implement.
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
})
afterAll(() => {
  rangeGeometry.forEach(([name, descriptor]) => {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor)
    else Reflect.deleteProperty(Range.prototype, name)
  })
})
const options = { virtualize: { enable: false } }
const errors = vi.fn()
const initialMarkdown =
  '# Theme\n\n[Theme link](https://example.com/theme)\n\n```js\n// A themed fence\nconst answer = 42\nfunction greet(name) { return "hello" }\n```'

function registeredRuntimeStyle() {
  const element = document.querySelector<HTMLStyleElement>('style[data-cap-runtime-styles]')
  expect(element).toBeTruthy()
  return element!
}

function registeredRuntimeRules() {
  const sheet = registeredRuntimeStyle().sheet
  expect(sheet).toBeTruthy()
  const visit = (rules: CSSRuleList): CSSStyleRule[] =>
    Array.from(rules).flatMap((rule) => {
      if (rule.type === CSSRule.STYLE_RULE) return [rule as CSSStyleRule]
      if ('cssRules' in rule) return visit((rule as CSSGroupingRule).cssRules)
      return []
    })
  return visit(sheet!.cssRules)
}

function expectRuntimeBinding(element: Element, property: string, variable: string) {
  // Read the stylesheet installed by the actual runtime. An older package can
  // accept arbitrary host style properties without rendering or consuming them.
  const rules = registeredRuntimeRules()
  const bindings = rules.filter((rule) => rule.style.getPropertyValue(property).includes(variable))
  expect(
    bindings.some((rule) => element.matches(rule.selectorText)),
    `${property}: ${variable}; selectors: ${bindings.map((rule) => rule.selectorText).join(', ')}; rules: ${rules.length}`,
  ).toBe(true)
}
function Host({
  tokens,
  onEditor,
  markdown = initialMarkdown,
  colorScheme,
}: {
  tokens: ResolvedTokens
  onEditor: (editor: CapricornRuntimeAdapter | null) => void
  markdown?: string
  colorScheme?: 'dark' | 'light'
}) {
  return (
    <SemanticThemeContext.Provider value={tokens}>
      <CapricornEditor
        active={false}
        visible
        initialMarkdown={markdown}
        options={colorScheme ? { ...options, colorScheme } : options}
        onChange={() => {}}
        onError={errors}
        onUnavailable={errors}
        onEditorChange={onEditor}
      />
    </SemanticThemeContext.Provider>
  )
}
describe('Capricorn instance themes', () => {
  it('renders and consumes semantic themes without replacing instances or documents', async () => {
    const first = vi.fn()
    const second = vi.fn()
    const light = resolveThemeTokens('light', { 'surface.canvas': '#ffffee' })
    const dark = resolveThemeTokens('dark', {
      'surface.canvas': '#112233',
      'editor.caret': '#fedcba',
      'editor.link': '#12abcd',
      'syntax.keyword': '#abcdef',
    })
    const content = (tokens: ResolvedTokens) => (
      <>
        <Host tokens={tokens} onEditor={first} />
        <Host tokens={light} onEditor={second} />
      </>
    )
    const view = render(content(light))
    await waitFor(
      () => expect(view.container.querySelectorAll('[data-cap-content]')).toHaveLength(2),
      { timeout: 15000 },
    )
    await waitFor(() => expect(first).toHaveBeenCalled())
    const adapter = first.mock.calls.find((call) => call[0])![0] as CapricornRuntimeAdapter
    const markdown = adapter.getMarkdown()
    const instance = view.container.querySelector<HTMLElement>('[data-cap-content]')!
    await waitFor(
      () => {
        for (const [role, text] of [
          ['comment', '// A themed fence'],
          ['keyword', 'const'],
          ['variable', 'answer'],
          ['number', '42'],
          ['title', 'greet'],
          ['string', '"hello"'],
        ])
          expect(
            Array.from(instance.querySelectorAll(`.cm-line .cap-syntax-${role}`)).some(
              (node) => node.textContent === text,
            ),
          ).toBe(true)
      },
      { timeout: 15000 },
    )
    const codeEditor = instance.querySelector('.cm-editor')!
    const keyword = instance.querySelector('.cap-syntax-keyword')!
    const link = instance.querySelector('a[href="https://example.com/theme"]')!
    expect(link).toBeTruthy()
    expectRuntimeBinding(instance, 'caret-color', '--cap-caret')
    expectRuntimeBinding(link, 'color', '--cap-link')
    expectRuntimeBinding(keyword, 'color', '--cap-code-token-keyword')
    // DOM runners omit custom Highlight pseudo-elements from CSSOM. Inspect
    // the actual injected stylesheet for this rule; the other bindings above
    // are checked against rendered elements and parsed style rules.
    expect(registeredRuntimeStyle().textContent).toMatch(
      /::highlight\(capricorn-selection\)\s*\{[^}]*color:\s*var\(--cap-selection-foreground[,)]/,
    )
    view.rerender(content(dark))
    await waitFor(() =>
      expect(instance.style.getPropertyValue('--cap-surface')).toBe(
        'var(--mf-theme-editor-background, #112233ff)',
      ),
    )
    expect(instance.style.getPropertyValue('--cap-code-token-keyword')).toBe(
      'var(--mf-theme-syntax-keyword, #abcdefff)',
    )
    expect(instance.style.getPropertyValue('--cap-caret')).toBe(
      'var(--mf-theme-editor-caret, #fedcbaff)',
    )
    expect(instance.style.getPropertyValue('--cap-link')).toBe(
      'var(--mf-theme-editor-link, #12abcdff)',
    )
    expect(
      (
        view.container.querySelectorAll('[data-cap-content]')[1] as HTMLElement
      ).style.getPropertyValue('--cap-surface'),
    ).toBe('var(--mf-theme-editor-background, #ffffeeff)')
    expect(view.container.querySelector('[data-cap-content]')).toBe(instance)
    expect(instance.querySelector('.cm-editor')).toBe(codeEditor)
    expect(instance.querySelector('.cap-syntax-keyword')).toBe(keyword)
    expect(adapter.getMarkdown()).toBe(markdown)
    expect(first.mock.calls.filter((call) => call[0])).toHaveLength(1)
    expect(errors).not.toHaveBeenCalled()
  }, 30000)

  it('recolors real Mermaid SVGs on theme changes without mixing instance caches or changing history', async () => {
    // Supply only geometry absent from the DOM runner. The runtime, Mermaid
    // parser/layout/renderer, sanitizer and theme observer remain unmocked.
    const geometry = ['getBBox', 'getComputedTextLength'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(SVGElement.prototype, name),
    ] as const)
    Object.defineProperties(SVGElement.prototype, {
      getBBox: {
        configurable: true,
        value(this: SVGElement) {
          return new DOMRect(0, 0, Math.max(16, (this.textContent || '').length * 8), 24)
        },
      },
      getComputedTextLength: {
        configurable: true,
        value(this: SVGElement) {
          return Math.max(16, (this.textContent || '').length * 8)
        },
      },
    })
    const first = vi.fn()
    const second = vi.fn()
    const tokens = { dark: resolveThemeTokens('dark'), light: resolveThemeTokens('light') }
    const markdown = '# Diagram\n\n```mermaid\nflowchart LR\n  A[Editor] --> B[Preview]\n```'
    const content = (scheme: 'dark' | 'light') => (
      <>
        <Host tokens={tokens[scheme]} colorScheme={scheme} markdown={markdown} onEditor={first} />
        <Host tokens={tokens.light} colorScheme='light' markdown={markdown} onEditor={second} />
      </>
    )
    const readySvg = async (instance: Element, previous?: SVGSVGElement) => {
      let svg: SVGSVGElement | null = null
      await waitFor(() => {
        const preview = instance.querySelector('[data-mermaid-preview]')
        expect(preview?.getAttribute('data-mermaid-preview'), preview?.textContent || '').toBe('ready')
        svg = preview!.querySelector('svg')
        expect(svg).toBeTruthy()
        expect(svg).not.toBe(previous)
        expect(svg!.querySelectorAll('.node')).toHaveLength(2)
        expect(svg!.querySelector('.nodes')?.textContent).toContain('Editor')
        expect(svg!.querySelector('.nodes')?.textContent).toContain('Preview')
      }, { timeout: 15000 })
      return svg!
    }
    const nodeFill = (svg: SVGSVGElement) => {
      const node = svg.querySelector('.node rect')
      expect(node).toBeTruthy()
      // jsdom does not register SVG <style> sheets. Evaluate the real generated
      // rules against their SVG nodes through an equivalent HTML style sheet.
      const style = document.createElement('style')
      style.textContent = svg.querySelector('style')?.textContent || ''
      expect(style.textContent).not.toBe('')
      document.head.append(style)
      try {
        return getComputedStyle(node!).fill.toLowerCase()
      } finally {
        style.remove()
      }
    }
    const history = (adapter: CapricornRuntimeAdapter) => {
      const { canUndo, canRedo } = adapter.getUiState()
      return { canUndo, canRedo }
    }
    const view = render(content('dark'))
    try {
      await waitFor(() => {
        expect(first.mock.calls.some((call) => call[0])).toBe(true)
        expect(second.mock.calls.some((call) => call[0])).toBe(true)
      }, { timeout: 15000 })
      const adapters = [first, second].map(
        (callback) => callback.mock.calls.find((call) => call[0])![0] as CapricornRuntimeAdapter,
      )
      const instances = Array.from(view.container.querySelectorAll('[data-cap-content]'))
      expect(instances).toHaveLength(2)
      const [darkSvg, lightSvg] = await Promise.all(instances.map((instance) => readySvg(instance)))
      // These are the real Mermaid dark/neutral node paints, not host CSS vars.
      const fills = { dark: nodeFill(darkSvg), light: nodeFill(lightSvg) }
      expect(['#1f2020', 'rgb(31, 32, 32)']).toContain(fills.dark)
      expect(['#eee', '#eeeeee', 'rgb(238, 238, 238)']).toContain(fills.light)
      const saved = adapters.map((adapter) => ({
        markdown: adapter.getMarkdown(),
        history: history(adapter),
        selection: adapter.resume?.capture(),
      }))
      expect(saved.map((state) => state.history)).toEqual([
        { canUndo: false, canRedo: false },
        { canUndo: false, canRedo: false },
      ])
      let previous = darkSvg
      for (const scheme of ['light', 'dark'] as const) {
        view.rerender(content(scheme))
        const current = await readySvg(instances[0], previous)
        expect(nodeFill(current)).toBe(fills[scheme])
        expect(instances[1].querySelector('[data-mermaid-preview] svg')).toBe(lightSvg)
        expect(Array.from(view.container.querySelectorAll('[data-cap-content]'))).toEqual(instances)
        adapters.forEach((adapter, index) => {
          expect(adapter.getMarkdown()).toBe(saved[index].markdown)
          expect(history(adapter)).toEqual(saved[index].history)
          expect(adapter.resume?.capture()).toEqual(saved[index].selection)
        })
        previous = current
      }
      expect(first.mock.calls.filter((call) => call[0])).toHaveLength(1)
      expect(second.mock.calls.filter((call) => call[0])).toHaveLength(1)
      expect(errors).not.toHaveBeenCalled()
    } finally {
      view.unmount()
      geometry.forEach(([name, descriptor]) => {
        if (descriptor) Object.defineProperty(SVGElement.prototype, name, descriptor)
        else Reflect.deleteProperty(SVGElement.prototype, name)
      })
    }
  }, 45000)
})

// Transform the runtime graph before UI wait deadlines in both package/source suites.
import 'virtual:markflowy-capricorn-runtime'
