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
})
