import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { useMemo } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CapricornEditor } from '@/components/EditorArea/CapricornEditor'
import type { CapricornRuntimeAdapter } from '@/components/EditorArea/capricornRuntimeAdapter'
import { mutateSnippet, useSnippetLibrary, useSnippetStore } from '@/features/snippets/store'
import type { SnippetLibrary } from '@/features/snippets/types'
import SnippetPreview from '@/router/Setting/SnippetSetting/SnippetPreview'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), listen: vi.fn(), t: (key: string) => key }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ listen: mocks.listen }))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: mocks.t }),
  i18n: {
    language: 'en',
    dir: () => 'ltr',
    on: () => {},
    off: () => {},
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  },
}))

const initial = (): SnippetLibrary => ({
  version: 1,
  revision: 1,
  items: [{ id: 'one', kind: 'code', title: 'Original', source: '${value}', language: 'python' }],
  hiddenBuiltinIds: [],
})
const instances: CapricornRuntimeAdapter[] = []
const changes = vi.fn()
const errors = vi.fn()
function Host() {
  const { library } = useSnippetLibrary()
  const options = useMemo(
    () => ({ snippets: { items: library.items }, virtualize: { enable: false } }),
    [library],
  )
  return (
    <CapricornEditor
      active={false}
      visible
      initialMarkdown={'```js\nexisting\n```'}
      options={options}
      onChange={changes}
      onError={errors}
      onUnavailable={errors}
      onEditorChange={(editor) => {
        if (editor) instances.push(editor)
      }}
    />
  )
}
beforeEach(() => {
  instances.splice(0)
  vi.clearAllMocks()
  useSnippetStore.setState({ library: initial(), loaded: true, error: null })
  mocks.listen.mockResolvedValue(() => {})
  mocks.invoke.mockResolvedValue(initial())
})
afterEach(async () => {
  cleanup()
  await act(async () => {})
  document.body.replaceChildren()
})

describe('snippet props with the Capricorn runtime', () => {
  it('updates open pickers in all editors after saving, retaining instances, content, selection and history', async () => {
    const { container } = render(
      <>
        <Host />
        <Host />
      </>,
    )
    await waitFor(() => expect(instances).toHaveLength(2))
    await waitFor(() =>
      expect(container.querySelectorAll('[data-cap-snippets-trigger="code"]')).toHaveLength(2),
    )
    const [first, second] = instances
    const sourceEditor = container.querySelector('.cm-editor')
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('[data-cap-snippets-trigger="code"]')!,
    )
    await waitFor(() =>
      expect(container.querySelector('[data-snippet-id="one"]')?.textContent).toContain('Original'),
    )
    const selection = first.resume?.capture()
    const saved = {
      ...initial(),
      revision: 2,
      items: [{ ...initial().items[0], title: 'Saved', source: 'literal ${next}' }],
    }
    mocks.invoke.mockResolvedValueOnce(saved)
    await act(async () => {
      await mutateSnippet({ type: 'upsert', item: saved.items[0] }, 1)
    })
    await waitFor(() =>
      expect(container.querySelector('[data-snippet-id="one"]')?.textContent).toContain('Saved'),
    )
    expect(instances).toEqual([first, second])
    expect(container.querySelector('.cm-editor')).toBe(sourceEditor)
    expect(first.resume?.capture()).toEqual(selection)
    expect(first.getMarkdown()).toBe('```js\nexisting\n```')
    expect(first.getUiState().canUndo).toBe(false)
    expect(second.getMarkdown()).toBe(first.getMarkdown())
    fireEvent.click(container.querySelector<HTMLButtonElement>('[data-snippet-id="one"]')!)
    await waitFor(() => expect(first.getMarkdown()).toContain('literal ${next}'))
    expect(first.getMarkdown()).toContain('```js')
    await act(async () => first.commands.undo())
    expect(first.getMarkdown()).toBe('```js\nexisting\n```')
    fireEvent.click(
      container.querySelectorAll<HTMLButtonElement>('[data-cap-snippets-trigger="code"]')[1],
    )
    await waitFor(() =>
      expect(container.querySelector('[data-snippet-id="one"]')?.textContent).toContain('Saved'),
    )
    expect(errors).not.toHaveBeenCalled()
  })

  it('uses an independent read-only preview without modifying or remounting an open document', async () => {
    render(<Host />)
    await waitFor(() => expect(instances).toHaveLength(1))
    const editor = instances[0]
    const markdown = editor.getMarkdown()
    changes.mockClear()
    const preview = render(
      <SnippetPreview
        snippet={{
          id: 'preview',
          kind: 'code',
          title: 'Preview',
          source: 'const raw = `${value}`;',
          language: 'typescript',
        }}
      />,
    )
    await waitFor(() => expect(preview.container.querySelector('[data-cap-editable]')).toBeTruthy())
    await waitFor(() => expect(preview.container.textContent).toContain('const raw'))
    expect(preview.container.querySelector('[data-cap-snippets-trigger]')).toBeNull()
    expect(preview.container.querySelector('[data-cap-input]')).toBeNull()
    expect(instances).toEqual([editor])
    expect(editor.getMarkdown()).toBe(markdown)
    expect(changes).not.toHaveBeenCalled()
    preview.unmount()
    expect(editor.getMarkdown()).toBe(markdown)
    expect(errors).not.toHaveBeenCalled()
  })
})
// Transform the runtime graph before the UI wait deadlines, matching the other host tests.
import 'virtual:markflowy-capricorn-runtime'
