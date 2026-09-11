import { describe, expect, it, vi } from 'vitest'
import {
  capricornClipboardCommands,
  createCapricornKeybindingConfiguration,
  toCapricornShortcut,
} from './capricornKeybindings'

describe('host keybinding translation', () => {
  it.each([
    ['mod-Shift-b', 'mod+Shift+b'],
    ['Ctrl--', 'Ctrl+-'],
    ['mod-+', 'mod++'],
    ['-', '-'],
    ['mod-[Numpad1]', 'mod+[Numpad1]'],
  ])('preserves the primary key in %s', (source, expected) => {
    expect(toCapricornShortcut(source)).toBe(expected)
  })

  it('retains startup defaults and disables cleared bindings after settings load', () => {
    expect(createCapricornKeybindingConfiguration({}, false).customizations).toEqual([
      { type: 'disable', targetRuleId: 'editor.find.open.default' },
    ])
    const configuration = createCapricornKeybindingConfiguration({}, true)
    expect(configuration.inheritDefaults).toBe(true)
    expect(configuration.customizations).toContainEqual({
      type: 'disable',
      targetRuleId: 'editor.format.bold.default',
    })
  })

  it('keeps copy native-only even if an adapter caller supplies custom copy keys', () => {
    const configuration = createCapricornKeybindingConfiguration(
      { copy: ['mod-Alt-c'], cut: 'mod-x', paste: 'mod-v' },
      true,
    )
    expect(configuration.customizations.filter((item) => item.type === 'add')).toEqual([])
    expect(capricornClipboardCommands?.map((command) => command.id)).not.toContain(
      'host.clipboard.copy',
    )
  })

  it('preserves alternative bindings for formatting and custom cut', () => {
    const configuration = createCapricornKeybindingConfiguration(
      {
        toggleStrong: ['mod-b', 'mod-Alt-b'],
        cut: ['mod-x', 'mod-Alt-x'],
      },
      true,
    )
    expect(configuration.customizations).toContainEqual({
      type: 'replace',
      targetRuleId: 'editor.format.bold.default',
      keys: ['mod+b', 'mod+Alt+b'],
    })
    expect(configuration.customizations.filter((item) => item.type === 'add')).toEqual([
      {
        type: 'add',
        rule: {
          id: 'host.clipboard.cut.custom',
          command: 'host.clipboard.cut',
          keys: ['mod+Alt+x'],
          when: { context: 'editor.focused', op: 'truthy' },
        },
      },
    ])
  })

  it('uses the native clipboard event bridge and restores the runtime input on failure', () => {
    const input = document.createElement('textarea')
    input.setAttribute('data-cap-input', 'true')
    input.value = 'pending input'
    input.setSelectionRange(2, 5)
    const previous = document.execCommand
    document.execCommand = vi.fn(() => {
      throw new Error('Clipboard denied')
    })
    try {
      expect(() =>
        capricornClipboardCommands![0].execute({
          event: { target: input } as unknown as KeyboardEvent,
        }),
      ).toThrow('Clipboard denied')
      expect(input.value).toBe('pending input')
      expect([input.selectionStart, input.selectionEnd]).toEqual([2, 5])
    } finally {
      document.execCommand = previous
    }
  })
})
