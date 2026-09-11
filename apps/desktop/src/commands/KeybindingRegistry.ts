import { formatKeyMap, shortcutString } from './keybindingKeys'
import type { KeyboardBinding } from './keybindingCatalog'

export class KeybindingRegistry {
  private keybindings = new Map<string, KeyboardBinding>()

  setKeybindings(keybindings: KeyboardBinding[]): void {
    this.keybindings.clear()
    keybindings.forEach((kb) => this.keybindings.set(kb.id, kb))
  }

  getKeybinding(commandId: string): KeyboardBinding | undefined {
    const bindings = this.getKeybindings(commandId)
    return bindings.find((binding) => binding.keys.length) ?? bindings[0]
  }

  getKeybindings(commandId?: string): KeyboardBinding[] {
    return Array.from(this.keybindings.values()).filter(
      (binding) => commandId === undefined || binding.command === commandId,
    )
  }

  formatKeybinding(commandId: string): string | undefined {
    const kb = this.getKeybinding(commandId)
    return kb ? this.formatKeyMap(kb.keys) : undefined
  }

  formatKeyMap(keyMap: string[]): string | undefined {
    if (keyMap.length === 0) return undefined
    return formatKeyMap(keyMap)
  }

  getKeyBindingString(keyMap: string[]): string {
    return shortcutString(keyMap)
  }
}

export const keybindingRegistry = new KeybindingRegistry()
