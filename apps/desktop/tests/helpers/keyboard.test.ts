import { describe, expect, it } from 'vitest'
import { createKeyboardEvent } from './keyboard'

describe('synthetic keyboard modifiers', () => {
  it.each([false, true])('keeps Alt separate from AltGraph with Control=%s', (ctrlKey) => {
    const event = createKeyboardEvent('keydown', { key: 'a', altKey: true, ctrlKey })
    expect(event.getModifierState('Alt')).toBe(true)
    expect(event.getModifierState('Control')).toBe(ctrlKey)
    expect(event.getModifierState('AltGraph')).toBe(false)
  })

  it('retains an explicitly requested AltGraph state and event cancellation', () => {
    const event = createKeyboardEvent('keydown', {
      key: '@',
      altKey: true,
      ctrlKey: true,
      modifierAltGraph: true,
    })
    expect(event.getModifierState('AltGraph')).toBe(true)
    event.preventDefault()
    expect(event.defaultPrevented).toBe(true)
  })
})
