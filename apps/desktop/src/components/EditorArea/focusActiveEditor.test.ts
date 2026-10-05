import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CapricornRuntimeAdapter } from './capricornRuntimeAdapter'
import { setCapricornEditor } from './capricornEditorRegistry'
import { sourceCodeCodemirrorViewMap } from './sourceCodeEditorInstances'
import {
  captureActiveEditorFocus,
  focusActiveEditor,
  isEditorPanelBlankTarget,
  scheduleActiveEditorFocus,
} from './focusActiveEditor'

afterEach(() => {
  document.body.replaceChildren()
  setCapricornEditor('test-file', undefined)
  sourceCodeCodemirrorViewMap.clear()
  vi.restoreAllMocks()
})

describe('focusActiveEditor', () => {
  it('focuses the editable surface inside the active editor', () => {
    document.body.innerHTML = `
      <div data-editor-active="false" tabindex="-1"></div>
      <div data-editor-active="true" tabindex="-1">
        <div contenteditable="true"></div>
      </div>
    `

    const editable = document.querySelector<HTMLElement>('[contenteditable="true"]')

    expect(focusActiveEditor()).toBe(true)
    expect(document.activeElement).toBe(editable)
  })

  it('preserves focus and selection when the active editor already contains focus', () => {
    document.body.innerHTML = `
      <div data-editor-active="true" tabindex="-1">
        <textarea>abc</textarea>
      </div>
    `
    const textarea = document.querySelector('textarea')!
    textarea.focus()
    textarea.setSelectionRange(1, 1)

    expect(focusActiveEditor()).toBe(true)
    expect(document.activeElement).toBe(textarea)
    expect(textarea.selectionStart).toBe(1)
  })

  it('uses the active preview container as a focus fallback', () => {
    document.body.innerHTML = '<div data-editor-active="true" tabindex="-1"></div>'
    const preview = document.querySelector<HTMLElement>('[data-editor-active="true"]')

    expect(focusActiveEditor()).toBe(true)
    expect(document.activeElement).toBe(preview)
  })

  it('returns false when no active editor is mounted', () => {
    expect(focusActiveEditor()).toBe(false)
  })

  it('restores the rich editor selection and its keyboard input outside the panel', () => {
    document.body.innerHTML = `
      <div data-editor-id="test-file" data-editor-active="true" tabindex="-1">
        <div data-mf-editor-mode="wysiwyg"><button tabindex="0">Block menu</button></div>
      </div>
      <textarea data-cap-input></textarea>
    `
    const input = document.querySelector('textarea')!
    const restore = vi.fn(() => true)
    const release = vi.fn()
    const editor = {
      focus: vi.fn(() => input.focus()),
      selection: { capture: () => ({ id: 'original-range' }), restore, release },
    } as unknown as CapricornRuntimeAdapter
    setCapricornEditor('test-file', editor)
    const snapshot = captureActiveEditorFocus()!

    expect(snapshot.restore()).toBe(true)
    expect(restore).toHaveBeenCalledWith('original-range')
    expect(document.activeElement).toBe(input)
    expect(focusActiveEditor()).toBe(true)
    expect(document.activeElement).toBe(input)
    snapshot.release()
    expect(release).toHaveBeenCalledWith('original-range')

    setCapricornEditor('test-file', undefined)
    expect(snapshot.restore()).toBe(false)
    expect(editor.focus).toHaveBeenCalledTimes(2)
  })

  it('cancels pending restoration when settings reopen before the next frame', () => {
    const cancelFrame = vi.spyOn(window, 'cancelAnimationFrame')
    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(15)
    const snapshot = { restore: vi.fn(), release: vi.fn() }
    const cancel = scheduleActiveEditorFocus(snapshot)
    cancel()
    expect(cancelFrame).toHaveBeenCalledWith(15)
    expect(snapshot.restore).not.toHaveBeenCalled()
    expect(snapshot.release).toHaveBeenCalledOnce()
  })
})

describe('isEditorPanelBlankTarget', () => {
  it('recognizes the editor scroll surface and document gutters as blank panel areas', () => {
    document.body.innerHTML = `
      <div data-editor-active="true">
        <div data-overlayscrollbars-contents data-overlayscrollbars-viewport>
          <div class="code-contents">
            <div id="editorarea-wrapper"></div>
          </div>
        </div>
      </div>
    `
    const editorPanel = document.querySelector<HTMLElement>('[data-editor-active="true"]')!
    const viewport = editorPanel.querySelector<HTMLElement>('[data-overlayscrollbars-viewport]')!
    const gutters = editorPanel.querySelector<HTMLElement>('.code-contents')!

    expect(isEditorPanelBlankTarget(editorPanel, editorPanel)).toBe(true)
    expect(isEditorPanelBlankTarget(viewport, editorPanel)).toBe(true)
    expect(isEditorPanelBlankTarget(gutters, editorPanel)).toBe(true)
  })

  it('does not treat editor content or elements outside the panel as blank areas', () => {
    document.body.innerHTML = `
      <div data-editor-active="true">
        <div class="code-contents">
          <div id="editorarea-wrapper"><button type="button">Action</button></div>
        </div>
      </div>
      <div class="code-contents" data-outside></div>
    `
    const editorPanel = document.querySelector<HTMLElement>('[data-editor-active="true"]')!
    const editorContent = editorPanel.querySelector<HTMLElement>('#editorarea-wrapper')!
    const action = editorPanel.querySelector<HTMLButtonElement>('button')!
    const outside = document.querySelector<HTMLElement>('[data-outside]')!

    expect(isEditorPanelBlankTarget(editorContent, editorPanel)).toBe(false)
    expect(isEditorPanelBlankTarget(action, editorPanel)).toBe(false)
    expect(isEditorPanelBlankTarget(outside, editorPanel)).toBe(false)
  })
})
