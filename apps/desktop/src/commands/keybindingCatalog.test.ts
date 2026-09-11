import { describe, expect, it } from 'vitest'
import {
  defaultKeybindingRules,
  getDefaultKeybindings,
  getKeybindingCommand,
  keybindingCommands,
} from './keybindingCatalog'
import { KeybindingRegistry } from './KeybindingRegistry'
import { editorKeymap, keybindingProblem } from './keybindingValidation'

describe('command and binding contracts', () => {
  it('defines unique rules with known commands and explicit editor adapters', () => {
    expect(new Set(keybindingCommands.map((command) => command.id)).size).toBe(
      keybindingCommands.length,
    )
    expect(new Set(defaultKeybindingRules.map((rule) => rule.id)).size).toBe(
      defaultKeybindingRules.length,
    )
    for (const rule of defaultKeybindingRules)
      expect(getKeybindingCommand(rule.command)).toBeDefined()
    for (const command of keybindingCommands) {
      if (command.target === 'editor') expect(command.editor?.rme).toBeTruthy()
    }
  })

  it.each(['mac', 'windows', 'linux'] as const)('keeps copy native-only on %s', (platform) => {
    const bindings = getDefaultKeybindings(platform)
    const copy = bindings.find((rule) => rule.command === 'editor_copy')!
    expect(copy).toMatchObject({
      configurable: false,
      target: 'native',
      when: 'editor_focus',
      keys: ['CommandOrCtrl', 'c'],
    })
    expect(keybindingProblem(bindings, copy.id, [])).toEqual({ type: 'reserved' })
    expect(keybindingProblem(bindings, copy.id, ['Alt', 'c'])).toEqual({ type: 'reserved' })
    // Adapter policy comes from command metadata, even if a caller supplies a forged row.
    const map = editorKeymap([
      { ...copy, configurable: true, target: 'editor', keys: ['Alt', 'c'] },
    ])
    expect(map).toEqual({})
    expect(editorKeymap(bindings).copy).toBeUndefined()
  })

  it('preserves alternative rules for one command in the registry and editor adapter', () => {
    const bold = getDefaultKeybindings('linux').find(
      (rule) => rule.command === 'editor_toggleStrong',
    )!
    const alternate = { ...bold, id: 'format.bold.alternative', keys: ['Alt', 'b'] }
    const registry = new KeybindingRegistry()
    registry.setKeybindings([bold, alternate])
    expect(registry.getKeybindings(bold.command)).toHaveLength(2)
    expect(editorKeymap(registry.getKeybindings())).toEqual({ toggleStrong: ['mod-b', 'Alt-b'] })
    registry.setKeybindings([{ ...bold, keys: [] }, alternate])
    expect(registry.getKeybinding(bold.command)?.id).toBe(alternate.id)
    expect(editorKeymap(registry.getKeybindings())).toEqual({ toggleStrong: ['Alt-b'] })
    expect(keybindingProblem(registry.getKeybindings(), alternate.id, ['Alt', 'b'])).toBeUndefined()
  })

  it('does not dispatch unregistered editor method names based on an ID prefix', () => {
    const bold = getDefaultKeybindings('linux').find(
      (rule) => rule.command === 'editor_toggleStrong',
    )!
    expect(editorKeymap([{ ...bold, command: 'editor_unregisteredMethod' }])).toEqual({})
  })
})
