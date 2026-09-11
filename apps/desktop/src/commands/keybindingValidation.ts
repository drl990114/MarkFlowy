import { canonicalKeyMap, keyMapsOverlap, validateKeyMap, shortcutString } from './keybindingKeys'
import {
  getKeybindingCommand,
  type EditorShortcutMap,
  type KeyboardBinding,
} from './keybindingCatalog'

export function keybindingProblem(
  bindings: readonly KeyboardBinding[],
  id: string,
  keys: string[],
) {
  const command = bindings.find((binding) => binding.id === id)
  if (!command?.configurable) return { type: 'reserved' as const }
  const invalid = validateKeyMap(keys, command.command)
  if (invalid) return { type: invalid }
  const canonical = canonicalKeyMap(keys)
  if (!canonical) return undefined
  const conflict = bindings.find(
    (binding) =>
      binding.command !== command.command &&
      (binding.when === 'always' || command.when === 'always' || binding.when === command.when) &&
      keyMapsOverlap(binding.keys, keys),
  )
  return conflict ? { type: 'conflict' as const, command: conflict.command } : undefined
}

export function editorKeymap(bindings: readonly KeyboardBinding[]): EditorShortcutMap {
  const shortcuts: Record<string, string[]> = {}
  for (const binding of bindings) {
    const command = getKeybindingCommand(binding.command)
    if (command?.target !== 'editor' || !command.configurable || !command.editor) continue
    const keys = (shortcuts[command.editor.rme] ??= [])
    const shortcut = validateKeyMap(binding.keys, binding.command)
      ? ''
      : shortcutString(binding.keys)
    if (shortcut && !keys.includes(shortcut)) keys.push(shortcut)
  }
  return shortcuts
}
