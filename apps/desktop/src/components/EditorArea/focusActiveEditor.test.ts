import { afterEach, describe, expect, it } from 'vitest'
import { focusActiveEditor } from './focusActiveEditor'

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
