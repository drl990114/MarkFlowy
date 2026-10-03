import { act, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { setCapricornEditor } from '@/components/EditorArea/capricornEditorRegistry'
import { getCapricornRuntimeInput } from '@/components/EditorArea/capricornRuntimeDom'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import {
  captureActiveEditorFocus,
  scheduleActiveEditorFocus,
} from '@/components/EditorArea/focusActiveEditor'

let editor: CapricornRuntimeAdapter | undefined
afterEach(async () => {
  setCapricornEditor('focus-test', undefined)
  await act(async () => editor?.destroy())
  editor = undefined
  document.body.replaceChildren()
})

describe('focus restoration against the installed Capricorn runtime', () => {
  it.each([
    { anchor: 6, focus: 6, expected: 'Hello Xworld!' },
    { anchor: 11, focus: 6, expected: 'Hello X!' },
  ])(
    'restores the caret/selection $anchor:$focus and accepts the next typed character',
    async ({ anchor, focus, expected }) => {
      const panel = document.createElement('div')
      panel.dataset.editorId = 'focus-test'
      panel.dataset.editorActive = 'true'
      const container = document.createElement('div')
      container.dataset.mfEditorMode = 'wysiwyg'
      panel.append(container)
      const settingsInput = document.createElement('input')
      document.body.append(panel, settingsInput)
      await act(async () => {
        editor = createCapricornRuntimeAdapter({
          container,
          createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
          options: { markdown: 'Hello world!', autoFocus: false, virtualize: { enable: false } },
          onChange: () => {},
        })
        setCapricornEditor('focus-test', editor)
        editor.resume!.restore({
          kind: 'capricorn',
          anchor: { path: [0, 0], offset: anchor },
          focus: { path: [0, 0], offset: focus },
        })
        editor.focus()
      })
      const input = getCapricornRuntimeInput(container)!
      expect(input).not.toBeNull()
      expect(panel.contains(input)).toBe(false)
      await waitFor(() => expect(document.activeElement).toBe(input))
      const selection = editor!.resume!.capture()
      const snapshot = captureActiveEditorFocus()
      await act(async () => {
        panel.inert = true
        settingsInput.focus()
      })
      expect(document.activeElement).toBe(settingsInput)

      await act(async () => {
        panel.inert = false
        scheduleActiveEditorFocus(snapshot)
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
      })
      await waitFor(() => expect(document.activeElement).toBe(input))
      expect(editor!.resume!.capture()).toEqual(selection)
      await act(async () => {
        const value = `${input.value.slice(0, input.selectionStart)}X${input.value.slice(input.selectionEnd)}`
        fireEvent.input(input, { target: { value }, data: 'X', inputType: 'insertText' })
      })
      await waitFor(() => expect(editor!.getMarkdown()).toBe(expected))
    },
  )
})
