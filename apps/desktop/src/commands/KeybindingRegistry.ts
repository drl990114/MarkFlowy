import { formatKeyMap, shortcutString } from './keybindingKeys'
import type { KeyboardBinding } from './keybindingCatalog'

export class KeybindingRegistry {
  private keybindings = new Map<string, KeyboardBinding>()
  private revision = 0
  private listeners = new Set<() => void>()

  getRevision = (): number => this.revision

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  setKeybindings(keybindings: KeyboardBinding[]): void {
    this.keybindings.clear()
    keybindings.forEach((kb) => this.keybindings.set(kb.id, kb))
    this.revision += 1
    this.listeners.forEach((listener) => listener())
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
