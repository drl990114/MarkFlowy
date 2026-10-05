// Transform the pinned runtime before the component's loading deadline.
import 'virtual:markflowy-capricorn-runtime'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { createRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import {
  CapricornEditor,
  type CapricornEditorHandle,
} from '@/components/EditorArea/CapricornEditor'
import type { CapricornRuntimeAdapter } from '@/components/EditorArea/capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from '@/components/EditorArea/capricornRuntimeDom'

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(cleanup)

const fixture = [
  '# Release notes',
  '',
  'Edit anchor outside the lists.',
  '',
  '- tight first',
  '- tight second',
  '',
  '- loose third',
  '',
  '',
  '- spaced fourth',
  '',
  '1. ordered first',
  '',
  '2. ordered second',
  '',
  '- [ ] task first',
  '',
  '- [x] task second',
  '',
  '- > semantic first',
  '',
  '- semantic second',
  '',
  '- parent',
  '    - child first',
  '',
  '    - child second',
  '',
  '- tail',
  '',
].join('\n')

describe.skipIf(!isCapricornRuntimeAvailable)('Capricorn host list spacing', () => {
  it.each(['\n', '\r\n'] as const)(
    'preserves all list gaps after an unrelated edit, snapshot, undo and redo (%j)',
    async (newline) => {
      const initialMarkdown = fixture.replaceAll('\n', newline)
      const edited = initialMarkdown.replace('anchor', 'changed')
      const ref = createRef<CapricornEditorHandle>()
      const onEditor = vi.fn()
      const onChange = vi.fn()
      const onError = vi.fn()
      const { container } = render(
        <CapricornEditor
          ref={ref}
          active
          visible
          initialMarkdown={initialMarkdown}
          options={{ virtualize: { enable: false } }}
          onEditorChange={onEditor}
          onChange={onChange}
          onError={onError}
          onUnavailable={onError}
        />,
      )
      await waitFor(() => expect(getCapricornRuntimeInput(container)).not.toBeNull())
      const adapter = onEditor.mock.calls.find(([editor]) => editor)?.[0] as
        | CapricornRuntimeAdapter
        | undefined
      expect(adapter).toBeDefined()
      expect(ref.current!.getMarkdown()).toBe(initialMarkdown)
      expect(onChange).not.toHaveBeenCalled()
      await act(async () => {
        await adapter!.find.searchAsync!({ query: 'anchor' })
        await adapter!.find.navigateTo!(0)
        adapter!.find.close()
        adapter!.focus()
      })
      const input = getCapricornRuntimeInput(container)!
      await act(async () => {
        fireEvent.input(input, {
          target: { value: 'changed' },
          inputType: 'insertText',
          data: 'changed',
        })
      })
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true })),
      )
      expect(ref.current!.getMarkdown()).toBe(edited)
      expect(adapter!.getMarkdown()).toBe(edited)
      await act(async () => adapter!.commands.undo())
      expect(ref.current!.getMarkdown()).toBe(initialMarkdown)
      await act(async () => adapter!.commands.redo())
      expect(ref.current!.getMarkdown()).toBe(edited)
      await act(async () => adapter!.setMode('preview'))
      expect(ref.current!.getMarkdown()).toBe(edited)
      expect(onError).not.toHaveBeenCalled()
      expect(onEditor.mock.calls.filter(([editor]) => editor)).toHaveLength(1)
    },
  )
})
