import {
  keybindingCommands,
  shortcutAlternatives,
  type EditorShortcutMap,
} from '@/commands/keybindingCatalog'
import { canonicalKeyMap, keybindingPlatform, normalizeKeyMap } from '@/commands/keybindingKeys'
import type {
  CapricornKeybindingConfiguration,
  CapricornRuntimeOptions,
} from './capricornRuntimeAdapter'

export function toCapricornShortcut(shortcut: string): string {
  const keys = normalizeKeyMap(shortcut.split(/-(?!$)/))
  if (!keys?.length) return ''
  const seen = new Set<string>()
  const mac = keybindingPlatform() === 'mac'
  const modifiers = keys.slice(0, -1).filter((modifier) => {
    const resolved = modifier === 'CommandOrCtrl' ? (mac ? 'Meta' : 'Ctrl') : modifier
    if (seen.has(resolved)) return false
    seen.add(resolved)
    return true
  })
  return [
    ...modifiers.map((modifier) => (modifier === 'CommandOrCtrl' ? 'mod' : modifier)),
    keys.at(-1)!,
  ].join('+')
}

export function createCapricornKeybindingConfiguration(
  keymap: Readonly<EditorShortcutMap>,
  loaded: boolean,
): CapricornKeybindingConfiguration {
  const configuration: CapricornKeybindingConfiguration = {
    inheritDefaults: true,
    customizations: [{ type: 'disable', targetRuleId: 'editor.find.open.default' }],
  }
  if (!loaded) return configuration
  const customizations: CapricornKeybindingConfiguration['customizations'][number][] =
    keybindingCommands.flatMap((command) => {
      const targetRuleId = command.editor?.capricornRule
      if (!targetRuleId || !command.editor) return []
      const keys = shortcutAlternatives(keymap[command.editor.rme] ?? [])
        .map(toCapricornShortcut)
        .filter(Boolean)
      return [
        keys.length
          ? { type: 'replace' as const, targetRuleId, keys }
          : { type: 'disable' as const, targetRuleId },
      ]
    })

  customizations.push(...configuration.customizations)

  // Copy and paste are native-only. Cut may have additional application aliases.
  const cutKeys = shortcutAlternatives(keymap.cut ?? [])
    .filter(
      (keys) => canonicalKeyMap(keys.split(/-(?!$)/)) !== canonicalKeyMap(['CommandOrCtrl', 'x']),
    )
    .map(toCapricornShortcut)
    .filter(Boolean)
  if (cutKeys.length)
    customizations.push({
      type: 'add',
      rule: {
        id: 'host.clipboard.cut.custom',
        command: 'host.clipboard.cut',
        keys: cutKeys,
        when: { context: 'editor.focused', op: 'truthy' },
      },
    })
  return { ...configuration, customizations }
}

export const capricornClipboardCommands: CapricornRuntimeOptions['commands'] = [
  {
    id: 'host.clipboard.cut',
    label: 'cut',
    precondition: { context: 'editor.editable', op: 'truthy' },
    execute: ({ event }) => {
      const input = event?.target
      if (!(input instanceof HTMLTextAreaElement) || !input.hasAttribute('data-cap-input'))
        return false
      const { value, selectionStart, selectionEnd, selectionDirection } = input
      try {
        input.value = ' '
        input.select()
        return input.ownerDocument.execCommand('cut')
      } finally {
        input.value = value
        input.setSelectionRange(selectionStart, selectionEnd, selectionDirection)
      }
    },
  },
]
