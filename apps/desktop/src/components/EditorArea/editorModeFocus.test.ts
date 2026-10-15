import { afterEach, describe, expect, it, vi } from 'vitest'
import { captureEditorModeFocus } from './editorModeFocus'

const cleanups: (() => void)[] = []

afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function capture(container: HTMLElement) {
  const pending = captureEditorModeFocus(container)
  if (pending) cleanups.push(pending.cancel)
  return pending
}

function mountEditor(source = false) {
  const container = document.createElement('div')
  const input = document.createElement(source ? 'textarea' : 'div')
  if (!source) {
    input.contentEditable = 'true'
    input.className = 'cm-content'
    input.tabIndex = 0
  }
  container.append(input)
  document.body.append(container)
  input.focus()
  return { container, input }
}

function mountPortal(documentKey: string) {
  const container = document.createElement('div')
  container.innerHTML = '<div data-cap-content><div data-cap-editable></div></div>'
  const documentNode = container.querySelector('[data-cap-editable]')!
  documentNode.setAttribute('data-cap-key', documentKey)
  const input = document.createElement('textarea')
  input.setAttribute('data-cap-input', 'true')
  input.setAttribute('data-cap-dockey', documentKey)
  document.body.append(container, input)
  return { container, input, documentNode }
}

describe('editor mode focus handoff', () => {
  it.each([false, true])('restores focus after replacing the focused editor (source: %s)', (source) => {
    const { container, input } = mountEditor(source)
    expect(document.activeElement).toBe(input)
    const pending = capture(container)
    expect(pending).toBeDefined()

    const replacement = document.createElement('textarea')
    container.replaceChildren(replacement)
    expect(document.activeElement).toBe(document.body)
    const restore = vi.fn(() => replacement.focus())
    pending!.restore(restore)
    expect(document.activeElement).toBe(replacement)
    pending!.restore(restore)
    expect(restore).toHaveBeenCalledOnce()
  })

  it('recognizes only the owning Capricorn portal and follows its replacement', () => {
    const current = mountPortal('current')
    const other = mountPortal('other')
    other.input.focus()
    expect(capture(current.container)).toBeUndefined()
    current.input.focus()
    const pending = capture(current.container)
    expect(pending).toBeDefined()

    const replacement = document.createElement('textarea')
    replacement.setAttribute('data-cap-input', 'true')
    replacement.setAttribute('data-cap-dockey', 'replacement')
    current.documentNode.setAttribute('data-cap-key', 'replacement')
    current.input.remove()
    document.body.append(replacement)
    replacement.focus()
    const restore = vi.fn()
    pending!.restore(restore)
    expect(restore).toHaveBeenCalledOnce()
  })

  it('does not capture unrelated focus or an already unfocused editor', () => {
    const { container, input } = mountEditor()
    input.blur()
    expect(capture(container)).toBeUndefined()
    const outside = document.createElement('input')
    document.body.append(outside)
    outside.focus()
    expect(capture(container)).toBeUndefined()
  })

  it('does not restore after the user focuses elsewhere and then returns focus to body', () => {
    const { container } = mountEditor()
    const pending = capture(container)!
    const outside = document.createElement('input')
    document.body.append(outside)
    outside.focus()
    outside.blur()
    expect(document.activeElement).toBe(document.body)
    const restore = vi.fn()
    pending.restore(restore)
    expect(restore).not.toHaveBeenCalled()
  })

  it.each(['blank area', 'outside element', 'keyboard', 'window blur', 'cancel'])(
    'cancels pending restoration on %s',
    (reason) => {
      const { container, input } = mountEditor()
      const pending = capture(container)!
      input.remove()
      if (reason === 'outside element') {
        const outside = document.createElement('div')
        document.body.append(outside)
        outside.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      } else if (reason === 'blank area') {
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      } else if (reason === 'keyboard') {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
      } else if (reason === 'window blur') {
        window.dispatchEvent(new Event('blur'))
      } else {
        pending.cancel()
      }
      const restore = vi.fn()
      pending.restore(restore)
      expect(restore).not.toHaveBeenCalled()
    },
  )

  it('keeps the handoff when interaction remains inside the same editor', () => {
    const { container, input } = mountEditor()
    const pending = capture(container)!
    input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift', bubbles: true }))
    const restore = vi.fn()
    pending.restore(restore)
    expect(restore).toHaveBeenCalledOnce()
  })

  it.each(['restore', 'cancel'] as const)('removes pending listeners after %s', (finish) => {
    const { container } = mountEditor()
    const addDocument = vi.spyOn(document, 'addEventListener')
    const removeDocument = vi.spyOn(document, 'removeEventListener')
    const addWindow = vi.spyOn(window, 'addEventListener')
    const removeWindow = vi.spyOn(window, 'removeEventListener')
    const pending = capture(container)!
    pending[finish](vi.fn())
    for (const type of ['focusin', 'pointerdown', 'keydown']) {
      const registration = addDocument.mock.calls.find(([event]) => event === type)
      expect(registration).toBeDefined()
      expect(removeDocument).toHaveBeenCalledWith(...registration!)
    }
    const blurRegistration = addWindow.mock.calls.find(([event]) => event === 'blur')
    expect(blurRegistration).toBeDefined()
    expect(removeWindow).toHaveBeenCalledWith(...blurRegistration!)
  })
})
