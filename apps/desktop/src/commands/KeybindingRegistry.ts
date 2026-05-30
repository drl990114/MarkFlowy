export interface KeybindingInfo {
  id: string
  keyMap: string[]
  when: string
}

class KeybindingRegistryImpl {
  private keybindings = new Map<string, KeybindingInfo>()

  setKeybindings(keybindings: KeybindingInfo[]): void {
    this.keybindings.clear()
    keybindings.forEach((kb) => this.keybindings.set(kb.id, kb))
  }

  getKeybinding(commandId: string): KeybindingInfo | undefined {
    return this.keybindings.get(commandId)
  }

  getKeybindings(): KeybindingInfo[] {
    return Array.from(this.keybindings.values())
  }

  formatKeybinding(commandId: string): string | undefined {
    const kb = this.keybindings.get(commandId)
    if (!kb || kb.keyMap.length === 0) return undefined
    return formatKeyMap(kb.keyMap)
  }

  updateKeybinding(commandId: string, newKeyMap: string[]): void {
    const kb = this.keybindings.get(commandId)
    if (kb) {
      this.keybindings.set(commandId, { ...kb, keyMap: newKeyMap })
    }
  }

  getKeyBindingString(keyMap: string[]): string {
    return getKeyBindingString(keyMap)
  }
}

function getKeyBindingString(keyMap: string[]): string {
  let keyBinding = ''
  keyMap.forEach((key, index) => {
    if (key === 'CommandOrCtrl') {
      keyBinding += 'mod'
    } else {
      keyBinding += key
    }

    if (index < keyMap.length - 1) {
      keyBinding += '-'
    }
  })
  return keyBinding
}

function formatKeyMap(keyMap: string[]): string {
  const isMac =
    typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().indexOf('MAC') >= 0

  return keyMap
    .map((key) => {
      if (key === 'CommandOrCtrl') {
        return isMac ? '⌘' : 'Ctrl'
      }
      if (key === 'Shift') return isMac ? '⇧' : 'Shift'
      if (key === 'Alt') return isMac ? '⌥' : 'Alt'
      if (key === 'Meta') return '⌘'
      if (key === 'Ctrl') return isMac ? '⌃' : 'Ctrl'
      return key
    })
    .join(isMac ? '' : '+')
}

export const keybindingRegistry = new KeybindingRegistryImpl()
