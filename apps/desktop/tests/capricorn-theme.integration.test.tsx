// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
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
  it('consumes independent highlight colors and updates them without changing the document', async () => {
    const onEditor = vi.fn()
    const markdown = 'Before ==marked **important**== after'
    const light = resolveThemeTokens('light')
    const dark = resolveThemeTokens('dark')
    const content = (tokens: ResolvedTokens) => (
      <Host tokens={tokens} markdown={markdown} onEditor={onEditor} />
    )
    const view = render(content(light))
    await waitFor(() => expect(onEditor).toHaveBeenCalled(), { timeout: 15000 })
    const adapter = onEditor.mock.calls.find((call) => call[0])![0] as CapricornRuntimeAdapter
    const instance = view.container.querySelector<HTMLElement>('[data-cap-content]')!
    // Each formatted leaf may own a separate <mark>; do not require a single wrapper.
    const marks = Array.from(instance.querySelectorAll('mark'))
    expect(marks.some((mark) => mark.textContent?.includes('important'))).toBe(true)
    const mark = marks[0]
    expect(mark).toBeTruthy()
    for (const highlighted of marks) {
      expectRuntimeBinding(highlighted, 'background', '--cap-highlight-background')
      expectRuntimeBinding(highlighted, 'color', '--cap-highlight-foreground')
    }
    view.rerender(content(dark))
    await waitFor(() => expect(instance.style.getPropertyValue('--cap-highlight-background')).toBe(
      `var(--mf-theme-editor-highlight-background, ${dark['editor.highlight.background']})`,
    ))
    expect(instance.style.getPropertyValue('--cap-highlight-foreground')).toBe(
      `var(--mf-theme-editor-highlight-foreground, ${dark['editor.highlight.foreground']})`,
    )
    expect(instance.querySelector('mark')).toBe(mark)
    expect(adapter.getMarkdown()).toBe(markdown)
    expect(onEditor.mock.calls.filter((call) => call[0])).toHaveLength(1)
    expect(errors).not.toHaveBeenCalled()
  }, 30000)

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
    // WebKit suppresses custom selection highlights under user-select: none.
    expect(getComputedStyle(instance).userSelect).toBe('text')
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

  it('binds live-preview math source tokens to the host dark palette', async () => {
    const onEditor = vi.fn()
    const dark = resolveThemeTokens('dark', {
      'syntax.tag': '#88ccff',
      'syntax.keyword': '#ffcc88',
    })
    const markdown = '$$\n\\begin{bmatrix}\n1 & 2 \\\\\n3 & 4\n\\end{bmatrix}\n$$'
    const view = render(
      <Host tokens={dark} colorScheme='dark' markdown={markdown} onEditor={onEditor} />,
    )
    await waitFor(() => {
      expect(view.container.querySelector('.capricorn-live-preview-block--math button[aria-expanded]')).toBeTruthy()
      expect(onEditor).toHaveBeenCalled()
    }, { timeout: 15000 })
    const adapter = onEditor.mock.calls.find((call) => call[0])![0] as CapricornRuntimeAdapter
    const initialHistory = adapter.getUiState().canUndo
    fireEvent.click(view.container.querySelector('.capricorn-live-preview-block--math button[aria-expanded]')!)
    const tokenWithText = (role: string, text: string) =>
      Array.from(view.container.querySelectorAll(`.capricorn-live-preview-block--math .cm-line .cap-syntax-${role}`))
        .find((token) => token.textContent === text)
    await waitFor(() => {
      expect(tokenWithText('tag', '\\begin')).toBeTruthy()
      expect(tokenWithText('keyword', 'bmatrix')).toBeTruthy()
    }, { timeout: 15000 })
    const instance = view.container.querySelector<HTMLElement>('[data-cap-content]')!
    expect(instance.getAttribute('data-cap-color-scheme')).toBe('dark')
    expect(instance.style.getPropertyValue('--cap-code-token-tag')).toBe(
      'var(--mf-theme-syntax-tag, #88ccffff)',
    )
    expect(instance.style.getPropertyValue('--cap-code-token-keyword')).toBe(
      'var(--mf-theme-syntax-keyword, #ffcc88ff)',
    )
    expectRuntimeBinding(tokenWithText('tag', '\\begin')!, 'color', '--cap-code-token-tag')
    expectRuntimeBinding(tokenWithText('keyword', 'bmatrix')!, 'color', '--cap-code-token-keyword')
    expect(adapter.getMarkdown()).toBe(markdown)
    expect(adapter.getUiState().canUndo).toBe(initialHistory)
    expect(errors).not.toHaveBeenCalled()
  }, 30000)
})

// Transform the runtime graph before UI wait deadlines in both package/source suites.
import 'virtual:markflowy-capricorn-runtime'
