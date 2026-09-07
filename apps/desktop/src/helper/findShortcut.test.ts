import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFindShortcutHandler } from './findShortcut'

afterEach(() => {
  document.body.replaceChildren()
})
describe('document Find capture', () => {
  it.each(['INPUT', 'TEXTAREA', 'DIV'])(
    'opens before a nested %s keymap can consume the key',
    (tag) => {
      const target = document.createElement(tag)
      document.body.append(target)
      const open = vi.fn(() => true)
      const nested = vi.fn((event: KeyboardEvent) => event.stopPropagation())
      target.addEventListener('keydown', nested)
      const handler = createFindShortcutHandler('Ctrl-f', open)
      window.addEventListener('keydown', handler, true)
      try {
        const event = new KeyboardEvent('keydown', {
          key: 'f',
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
        target.dispatchEvent(event)
        expect(open).toHaveBeenCalledOnce()
        expect(nested).not.toHaveBeenCalled()
        expect(event.defaultPrevented).toBe(true)
      } finally {
        window.removeEventListener('keydown', handler, true)
      }
    },
  )
  it('honors customization, disabled bindings, IME and unsupported contexts', () => {
    const open = vi.fn(() => true)
    const handler = createFindShortcutHandler('Ctrl-Shift-h', open)
    handler(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
    handler(
      new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, shiftKey: true, isComposing: true }),
    )
    expect(open).not.toHaveBeenCalled()
    handler(new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, shiftKey: true }))
    expect(open).toHaveBeenCalledOnce()
    createFindShortcutHandler('', open)(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }))
    expect(open).toHaveBeenCalledOnce()
    const event = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, cancelable: true })
    createFindShortcutHandler('Ctrl-f', () => false)(event)
    expect(event.defaultPrevented).toBe(false)
  })
})
