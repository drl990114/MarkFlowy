import { useSyncExternalStore } from 'react'
import { keybindingRegistry } from './KeybindingRegistry'
import { getDefaultKeybindings, type KeyboardBinding } from './keybindingCatalog'
import { formatKeyMap, keybindingPlatform } from './keybindingKeys'

export function useCommandKeybinding(commandId: string): KeyboardBinding | undefined {
  const revision = useSyncExternalStore(
    keybindingRegistry.subscribe,
    keybindingRegistry.getRevision,
    keybindingRegistry.getRevision,
  )
  return revision
    ? keybindingRegistry.getKeybinding(commandId)
    : getDefaultKeybindings(keybindingPlatform()).find((rule) => rule.command === commandId)
}

export function useCommandShortcut(commandId: string): string | undefined {
  const binding = useCommandKeybinding(commandId)
  return binding?.keys.length ? formatKeyMap(binding.keys) : undefined
}
