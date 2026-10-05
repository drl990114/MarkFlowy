// @vitest-environment jsdom
import 'virtual:markflowy-capricorn-runtime'
import { EditorView } from '@codemirror/view'
import { act } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { setCapricornEditor } from './capricornEditorRegistry'
import {
  createCapricornRuntimeAdapter,
  loadCapricornRuntimeFactory,
  type CapricornRuntimeAdapter,
} from './capricornRuntimeAdapter'
import { getCapricornRuntimeInput, guardCapricornHistoryInput } from './capricornRuntimeDom'
import { captureActiveEditorFocus } from './focusActiveEditor'

const cleanups: (() => void)[] = []
beforeAll(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => document.createElement('div').getBoundingClientRect(),
  })
})
afterEach(async () => {
  await act(async () => cleanups.splice(0).reverse().forEach((cleanup) => cleanup()))
  setCapricornEditor('focus-file', undefined)
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

async function mountEditor() {
  const panel = document.createElement('div')
  panel.dataset.editorId = 'focus-file'
  panel.dataset.editorActive = 'true'
  const container = document.createElement('div')
  container.dataset.mfEditorMode = 'wysiwyg'
  panel.append(container)
  document.body.append(panel)
  const createRuntime = await loadCapricornRuntimeFactory()
  const onChange = vi.fn()
  let adapter!: CapricornRuntimeAdapter
  await act(async () => {
    adapter = createCapricornRuntimeAdapter({
      container,
      createRuntime,
      onChange,
      options: {
        markdown: 'Before\n\n```text\nhello world\n```\n\nAfter',
        virtualize: { enable: false },
      },
    })
  })
  cleanups.push(() => adapter.destroy())
  setCapricornEditor('focus-file', adapter)
  const content = container.querySelector<HTMLElement>('.cm-content')!
  const view = EditorView.findFromDOM(content)!
  expect(view).not.toBeNull()
  await act(async () => {
    view.focus()
    view.dispatch({ selection: { anchor: 8, head: 2 } })
  })
  expect(view.hasFocus).toBe(true)
  const overlay = document.createElement('input')
  document.body.append(overlay)
  return { adapter, container, onChange, overlay, view }
}

describe.skipIf(!isCapricornRuntimeAvailable)('published Capricorn embedded code focus', () => {
  it.each([false, true])(
    'restores directional code selection after an overlay (via menu: %s)',
    async (viaMenu) => {
      const { adapter, onChange, overlay, view } = await mountEditor()
      if (viaMenu) {
        const menuItem = document.createElement('button')
        document.body.append(menuItem)
        await act(async () => menuItem.focus())
      }
      const snapshot = captureActiveEditorFocus()!
      await act(async () => {
        overlay.focus()
        view.dispatch({ selection: { anchor: 0 } })
      })
      onChange.mockClear()
      await act(async () => expect(snapshot.restore()).toBe(true))
      expect(document.activeElement).toBe(view.contentDOM)
      expect(view.state.selection.main).toMatchObject({ anchor: 8, head: 2 })
      expect(onChange.mock.calls.some(([event]) => event?.documentChanged)).toBe(false)
      await act(async () => view.dispatch(view.state.replaceSelection('X')))
      expect(adapter.getMarkdown()).toContain('heXrld')
      snapshot.release()
    },
  )

  it('focuses the code block without overwriting newer content or selection', async () => {
    const { overlay, view } = await mountEditor()
    const snapshot = captureActiveEditorFocus()!
    await act(async () => {
      overlay.focus()
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: 'new code' },
        selection: { anchor: 3, head: 1 },
      })
    })
    await act(async () => expect(snapshot.restore()).toBe(true))
    expect(view.hasFocus).toBe(true)
    expect(view.state.doc.toString()).toBe('new code')
    expect(view.state.selection.main).toMatchObject({ anchor: 3, head: 1 })
    snapshot.release()
  })

  it('returns to the body portal after the user leaves the code block for prose', async () => {
    const { adapter, container, overlay } = await mountEditor()
    const input = getCapricornRuntimeInput(container)!
    await act(async () => {
      expect(adapter.resume!.restore({
        kind: 'capricorn',
        anchor: { path: [0, 0], offset: 2 },
        focus: { path: [0, 0], offset: 2 },
      })).toBe(true)
      adapter.focus()
    })
    await vi.waitFor(() => expect(document.activeElement).toBe(input))
    expect(adapter.captureEmbeddedCodeFocus!()).toBeNull()
    const snapshot = captureActiveEditorFocus()!
    await act(async () => overlay.focus())
    await act(async () => expect(snapshot.restore()).toBe(true))
    expect(document.activeElement).toBe(input)
    snapshot.release()
  })

  it('rejects removed code blocks and releases focus tracking when the adapter is destroyed', async () => {
    const { adapter, overlay } = await mountEditor()
    const snapshot = adapter.captureEmbeddedCodeFocus!()!
    const removeListener = vi.spyOn(document, 'removeEventListener')
    await act(async () => {
      overlay.focus()
      adapter.setMarkdown('Replacement document')
    })
    expect(snapshot.restore()).toBe(false)
    expect(adapter.captureEmbeddedCodeFocus!()).toBeNull()
    await act(async () => adapter.destroy())
    expect(removeListener.mock.calls.some(([type, , capture]) => type === 'focusin' && capture === true)).toBe(true)
    expect(adapter.captureEmbeddedCodeFocus!()).toBeNull()
  })

  it('does not restore the former adapter when the active editor instance changes', async () => {
    const { overlay } = await mountEditor()
    const snapshot = captureActiveEditorFocus()!
    setCapricornEditor('focus-file', undefined)
    overlay.focus()
    expect(snapshot.restore()).toBe(false)
    expect(document.activeElement).toBe(overlay)
    snapshot.release()
  })

  it('allows native undo in the focused embedded editor while blocking an unfocused one', async () => {
    const { container, overlay, view } = await mountEditor()
    cleanups.push(guardCapricornHistoryInput(container, () => true))
    await act(async () => view.dispatch(view.state.replaceSelection('X')))
    expect(view.state.doc.toString()).toBe('heXrld')
    const undo = () => view.contentDOM.dispatchEvent(new InputEvent('beforeinput', {
      inputType: 'historyUndo', bubbles: true, cancelable: true,
    }))
    await act(async () => {
      overlay.focus()
      undo()
    })
    expect(view.state.doc.toString()).toBe('heXrld')
    await act(async () => {
      view.focus()
      undo()
    })
    expect(view.state.doc.toString()).toBe('hello world')
  })
})
