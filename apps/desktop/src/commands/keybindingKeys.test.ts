import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canonicalKeyMap,
  keyMapsOverlap,
  normalizeKeyMap,
  sameKeyMap,
  shortcutString,
  validateKeyMap,
} from './keybindingKeys'
import { keybindingProblem } from './keybindingValidation'
import { getDefaultKeybindings } from './keybindingCatalog'
import { recordKey } from '@/router/Setting/KeyboardTable/record-key'
import { createKeybindingsHandler } from '@/helper/bindkeys'

afterEach(() => vi.restoreAllMocks())
const press = (init: KeyboardEventInit) =>
  new KeyboardEvent('keydown', { cancelable: true, ...init })

describe('shortcut recording and dispatch contract', () => {
  it.each(['MacIntel', 'Win32', 'Linux x86_64'])(
    'round trips recorded letters, symbols and numpad on %s',
    (platform) => {
      vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform)
      vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(platform)
      const modifier = platform === 'MacIntel' ? { metaKey: true } : { ctrlKey: true }
      for (const init of [
        { key: 'k', code: 'KeyK', keyCode: 75 },
        { key: 'K', code: 'KeyK', keyCode: 75, shiftKey: true },
        { key: '+', code: 'Equal', shiftKey: true, keyCode: 187 },
        { key: '-', code: 'Minus', keyCode: 189 },
        { key: '1', code: 'Numpad1', keyCode: 97 },
        { key: 'z', code: 'KeyY', keyCode: 89 },
      ]) {
        const recorded = recordKey(press({ ...init, ...modifier }))!
        const action = vi.fn(() => true)
        createKeybindingsHandler({ [shortcutString(recorded)]: action })(
          press({ ...init, ...modifier }),
        )
        expect(action, JSON.stringify(recorded)).toHaveBeenCalledOnce()
      }
    },
  )
  it('preserves both macOS Control and Command', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    expect(recordKey(press({ key: 'k', code: 'KeyK', ctrlKey: true, metaKey: true }))).toEqual([
      'CommandOrCtrl',
      'Ctrl',
      'k',
    ])
  })
  it.each(['Tab', 'Escape', 'Enter'])('leaves %s available for dialog navigation', (key) => {
    const event = press({ key, code: key })
    expect(recordKey(event)).toBeNull()
    expect(event.defaultPrevented).toBe(false)
  })
  it('does not record a modifier or composition', () => {
    expect(recordKey(press({ key: 'Meta', metaKey: true }))).toBeNull()
    expect(recordKey(press({ key: 'k', isComposing: true }))).toBeNull()
    expect(normalizeKeyMap(['Ctrl'])).toBeNull()
    expect(normalizeKeyMap(['Ctrl', 'a', 'b'])).toBeNull()
    expect(normalizeKeyMap(['Ctrl', 'Numpad1'])).toBeNull()
    const altGraph = press({ key: '@', ctrlKey: true, altKey: true })
    Object.defineProperty(altGraph, 'getModifierState', {
      value: (key: string) => key === 'AltGraph',
    })
    expect(recordKey(altGraph)).toBeNull()
  })
  it('normalizes uppercase, modifier ordering and platform aliases', () => {
    expect(canonicalKeyMap(['Shift', 'CommandOrCtrl', 'K'], 'mac')).toBe(
      canonicalKeyMap(['Meta', 'Shift', 'k'], 'mac'),
    )
    expect(canonicalKeyMap(['Ctrl', 'k'], 'windows')).toBe(
      canonicalKeyMap(['CommandOrCtrl', 'K'], 'windows'),
    )
    expect(canonicalKeyMap(['Ctrl', 'Shift', '+'])).not.toBe(
      canonicalKeyMap(['Shift', 'Ctrl', '=']),
    )
    expect(sameKeyMap(['Ctrl', 'S'], ['Ctrl', 's'])).toBe(true)
    expect(sameKeyMap(['CommandOrCtrl', 's'], ['Ctrl', 's'])).toBe(false)
  })
  it('rejects character-only and reserved clipboard/editor navigation bindings', () => {
    expect(validateKeyMap(['a'], 'app_save')).toBe('reserved')
    expect(validateKeyMap(['Shift', 'a'], 'app_save')).toBe('reserved')
    expect(validateKeyMap(['F2'], 'app_save')).toBeUndefined()
    expect(validateKeyMap(['CommandOrCtrl', 'ArrowUp'], 'editor_toggleStrong')).toBe('reserved')
    expect(validateKeyMap(['CommandOrCtrl', 'c'], 'app_save')).toBe('reserved')
    expect(validateKeyMap(['CommandOrCtrl', 'c'], 'editor_copy')).toBeUndefined()
  })
  it('ignores consumed keys, composition and AltGraph', () => {
    const action = vi.fn()
    const handler = createKeybindingsHandler({ 'Ctrl-k': action })
    const event = press({ key: 'k', ctrlKey: true })
    event.preventDefault()
    handler(event)
    handler(press({ key: 'k', ctrlKey: true, isComposing: true }))
    handler(press({ key: 'k', ctrlKey: true, keyCode: 229 }))
    const altGraph = press({ key: 'k', ctrlKey: true })
    Object.defineProperty(altGraph, 'getModifierState', {
      value: (key: string) => key === 'AltGraph',
    })
    handler(altGraph)
    expect(action).not.toHaveBeenCalled()
  })
  it('checks overlapping scopes and ignores a command itself', () => {
    const bindings = getDefaultKeybindings('linux')
    expect(
      keybindingProblem(bindings, 'editor_toggleStrong.default', ['CommandOrCtrl', 's']),
    ).toEqual({
      type: 'conflict',
      command: 'app_save',
    })
    expect(keybindingProblem(bindings, 'app_save.default', ['CommandOrCtrl', 's'])).toBeUndefined()
    expect(keybindingProblem(bindings, 'app_save.default', [])).toBeUndefined()
  })
  it('uses stable numpad aliases without conflating separate physical keys', () => {
    expect(keyMapsOverlap(['Ctrl', '[Numpad1]'], ['Ctrl', 'End'])).toBe(true)
    expect(keyMapsOverlap(['Ctrl', '[NumpadDecimal]'], ['Ctrl', ','])).toBe(true)
    expect(keyMapsOverlap(['Ctrl', '[NumpadAdd]'], ['Ctrl', '+'])).toBe(true)
    expect(keyMapsOverlap(['Ctrl', '[NumpadComma]'], ['Ctrl', '[NumpadDecimal]'])).toBe(false)
    expect(keyMapsOverlap(['Ctrl', 'Shift', '[Numpad1]'], ['Ctrl', '1'])).toBe(false)
  })
  it('retains physical digit identity across layouts', () => {
    const command = vi.fn()
    const handler = createKeybindingsHandler({ 'Ctrl-Shift-[Digit1]': command })
    for (const key of ['!', '1'])
      handler(press({ key, code: 'Digit1', ctrlKey: true, shiftKey: true }))
    handler(press({ key: '1', code: 'Numpad1', ctrlKey: true, shiftKey: true }))
    expect(command).toHaveBeenCalledTimes(2)
  })
})
