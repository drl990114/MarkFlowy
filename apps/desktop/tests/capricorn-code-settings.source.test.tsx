// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest'
import { CapricornEditor } from '@/components/EditorArea/CapricornEditor'
import type { CapricornRuntimeAdapter } from '@/components/EditorArea/capricornRuntimeAdapter'
import { resolveCodeEditorPreferences } from '@/components/EditorArea/codeEditorSettings'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
  i18n: { language: 'en', dir: () => 'ltr', on: () => {}, off: () => {}, t: (key: string) => key },
}))

const geometry = ['getClientRects', 'getBoundingClientRect'].map(
  (name) => [name, Object.getOwnPropertyDescriptor(Range.prototype, name)] as const,
)
beforeAll(() =>
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  }),
)
afterEach(cleanup)
afterAll(() => {
  geometry.forEach(([name, descriptor]) => {
    if (descriptor) Object.defineProperty(Range.prototype, name, descriptor)
    else Reflect.deleteProperty(Range.prototype, name)
  })
})

it('applies persisted host overrides and resets the same runtime without dirtying either pane', async () => {
  const onEditor = vi.fn()
  const onChange = vi.fn()
  const onError = vi.fn()
  const markdown = `# Code\n\n\`\`\`text\n${Array.from({ length: 12 }, (_, index) => `line ${index + 1}  `).join('\n')}\n\`\`\`\n`
  function Host({
    settings = {},
    owner = false,
  }: {
    settings?: Record<string, unknown>
    owner?: boolean
  }) {
    const preferences = resolveCodeEditorPreferences(settings)
    return (
      <CapricornEditor
        active={false}
        visible
        initialMarkdown={markdown}
        options={{
          virtualize: { enable: false },
          codeEditor: preferences.embedded,
          codeBlockLineWrapping: preferences.legacyLineWrapping,
          style: {
            '--cap-code-font-size': preferences.fontSize,
            '--cap-code-line-height': preferences.lineHeight,
          },
        }}
        onEditorChange={owner ? onEditor : undefined}
        onChange={onChange}
        onError={onError}
        onUnavailable={onError}
      />
    )
  }
  const content = (settings: Record<string, unknown>) => (
    <>
      <Host settings={settings} owner />
      <Host />
    </>
  )
  const rendered = render(content({}))
  await waitFor(() => expect(rendered.container.querySelectorAll('.cm-editor')).toHaveLength(2), {
    timeout: 15000,
  })
  const [first, second] = Array.from(rendered.container.querySelectorAll('.cm-editor'))
  await waitFor(() => expect(onEditor).toHaveBeenCalled())
  const runtime = onEditor.mock.calls.find(([adapter]) => adapter)?.[0] as CapricornRuntimeAdapter
  const original = runtime.getMarkdown()
  expect(first.querySelector('.cm-lineNumbers')).not.toBeNull()

  rendered.rerender(
    content({
      embedded_code_editor_line_wrap: 'off',
      embedded_code_editor_line_numbers: 'off',
      embedded_code_editor_highlight_active_line: 'off',
      editor_code_whitespace: 'all',
      editor_code_font_size: 20,
      editor_code_line_height: '1.8',
    }),
  )
  await waitFor(() => {
    expect(first.querySelector('.cm-lineNumbers')).toBeNull()
    expect(first.querySelector('.cm-lineWrapping')).toBeNull()
    expect(first.querySelector('.cm-highlightSpace')).not.toBeNull()
  })
  expect(second.querySelector('.cm-lineNumbers')).not.toBeNull()
  expect(second.querySelector('.cm-lineWrapping')).not.toBeNull()
  const root = rendered.container.querySelector<HTMLElement>('[data-cap-content]')!
  expect(root.style.getPropertyValue('--cap-code-font-size')).toBe('20px')
  expect(root.style.getPropertyValue('--cap-code-line-height')).toBe('1.8')

  rendered.rerender(content({ embedded_code_editor_line_numbers: 'sparse' }))
  await waitFor(() => {
    const labels = Array.from(first.querySelectorAll('.cm-lineNumbers .cm-gutterElement')).map(
      (node) => node.textContent,
    )
    expect(labels).toContain('1')
    expect(labels).toContain('10')
    expect(labels).not.toContain('2')
  })
  rendered.rerender(content({}))
  await waitFor(() => {
    expect(first.querySelector('.cm-lineWrapping')).not.toBeNull()
    expect(first.querySelector('.cm-highlightSpace')).toBeNull()
    expect(root.style.getPropertyValue('--cap-code-font-size')).toBe('')
  })
  expect(rendered.container.querySelectorAll('.cm-editor')[0]).toBe(first)
  expect(rendered.container.querySelectorAll('.cm-editor')[1]).toBe(second)
  expect(onEditor.mock.calls.filter(([adapter]) => adapter)).toHaveLength(1)
  expect(runtime.getMarkdown()).toBe(original)
  expect(onChange).not.toHaveBeenCalled()
  expect(onError).not.toHaveBeenCalled()
}, 30000)
