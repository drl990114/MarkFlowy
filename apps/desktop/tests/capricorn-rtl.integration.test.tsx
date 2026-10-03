import 'virtual:markflowy-capricorn-runtime'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapricornEditor } from '@/components/EditorArea/CapricornEditor'
import type {
  CapricornRuntimeAdapter,
  CapricornRuntimeOptions,
} from '@/components/EditorArea/capricornRuntimeAdapter'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)

const bodyBlocks = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLElement>('[data-cap-leaf-block]'),
]
const localization = {
  getDirection: () => 'ltr' as const,
  translate: ({ defaultValue }: { defaultValue: string }) => defaultValue,
}

describe('Capricorn body direction through the Desktop host', () => {
  it.each(['edit', 'preview'] as const)(
    'automatically resolves mixed body blocks in %s without changing interface direction or table order',
    async (mode) => {
      const onError = vi.fn()
      const onEditorChange = vi.fn()
      const markdown =
        '# 😀 مرحبا\n\nEnglish שלום\n\n> שלום\n\n- فارسی\n\n| مرحبا | English |\n| --- | --- |\n| שלום | 123 😀 |'
      const { container } = render(
        <CapricornEditor
          active={false}
          visible
          initialMarkdown={markdown}
          onChange={vi.fn()}
          onError={onError}
          onUnavailable={onError}
          onEditorChange={onEditorChange}
          options={{ mode, textDirection: 'auto', localization, virtualize: { enable: false } }}
        />,
      )
      await waitFor(() => expect(bodyBlocks(container)).toHaveLength(8))
      expect(bodyBlocks(container).map((block) => block.dir)).toEqual([
        'rtl',
        'ltr',
        'rtl',
        'rtl',
        'rtl',
        'ltr',
        'rtl',
        'ltr',
      ])
      expect(container.querySelector<HTMLElement>('[data-cap-content]')!.dir).toBe('ltr')
      const rows = [...container.querySelectorAll<HTMLElement>('[data-markdown-block="table-row"]')]
      expect(rows).toHaveLength(2)
      expect(rows.map((row) => row.dir)).toEqual(['ltr', 'ltr'])
      const adapter = onEditorChange.mock.calls.find(
        ([editor]) => editor,
      )![0] as CapricornRuntimeAdapter
      expect(adapter.getMarkdown()).toBe(markdown)
      expect(onError).not.toHaveBeenCalled()
    },
  )

  it('switches the existing session between auto, RTL and LTR without losing edits, selection or undo', async () => {
    const onEditorChange = vi.fn()
    const onChange = vi.fn()
    const onError = vi.fn()
    const original = 'abc אבג\n\nمرحبا English'
    const props = {
      active: false,
      visible: true,
      initialMarkdown: original,
      onEditorChange,
      onChange,
      onError,
      onUnavailable: onError,
    }
    const options: CapricornRuntimeOptions = {
      textDirection: 'auto',
      localization,
      virtualize: { enable: false },
    }
    const { container, rerender } = render(<CapricornEditor {...props} options={options} />)
    await waitFor(() => expect(onEditorChange).toHaveBeenCalled())
    const adapter = onEditorChange.mock.calls.find(
      ([editor]) => editor,
    )![0] as CapricornRuntimeAdapter
    await act(async () => {
      expect(
        adapter.resume!.restore({
          kind: 'capricorn',
          anchor: { path: [0, 0], offset: 1 },
          focus: { path: [0, 0], offset: 3 },
        }),
      ).toBe(true)
      adapter.commands.setBlockType('heading-2')
    })
    const edited = adapter.getMarkdown()
    expect(edited).toBe('## abc אבג\n\nمرحبا English')
    const selection = adapter.resume!.capture()
    const surface = container.querySelector('[data-cap-content]')
    expect(adapter.getUiState().canUndo).toBe(true)
    onChange.mockClear()
    for (const [textDirection, directions] of [
      ['rtl', ['rtl', 'rtl']],
      ['ltr', ['ltr', 'ltr']],
      ['auto', ['ltr', 'rtl']],
    ] as const) {
      rerender(<CapricornEditor {...props} options={{ ...options, textDirection }} />)
      await waitFor(() =>
        expect(bodyBlocks(container).map((block) => block.dir)).toEqual(directions),
      )
      expect(container.querySelector('[data-cap-content]')).toBe(surface)
      expect(adapter.getMarkdown()).toBe(edited)
      expect(adapter.resume!.capture()).toEqual(selection)
      expect(adapter.getUiState().canUndo).toBe(true)
    }
    expect(onEditorChange.mock.calls.filter(([editor]) => editor)).toHaveLength(1)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    await act(async () => adapter.commands.undo())
    expect(adapter.getMarkdown()).toBe(original)
    expect(onError).not.toHaveBeenCalled()
  })

  it('keeps code blocks LTR when body direction is forced to RTL', async () => {
    const onError = vi.fn()
    const { container } = render(
      <CapricornEditor
        active={false}
        visible
        initialMarkdown={'English שלום\n\n```js\nconst greeting = "مرحبا"\n```'}
        onChange={vi.fn()}
        onError={onError}
        onUnavailable={onError}
        options={{ textDirection: 'rtl', localization, virtualize: { enable: false } }}
      />,
    )
    await waitFor(() => expect(container.querySelector('.cm-content')).not.toBeNull(), {
      timeout: 15000,
    })
    expect(bodyBlocks(container)[0].dir).toBe('rtl')
    expect(container.querySelector('.cm-content')!.getAttribute('dir')).toBe('ltr')
    expect(onError).not.toHaveBeenCalled()
  })
})
