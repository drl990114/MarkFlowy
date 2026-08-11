import { afterEach, describe, expect, it } from 'vitest'
import { focusActiveEditor, isEditorPanelBlankTarget } from './focusActiveEditor'

afterEach(() => {
  document.body.replaceChildren()
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
