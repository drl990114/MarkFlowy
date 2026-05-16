import { ExtensionStore } from '@rme-sdk/main'
import { Command } from '@rme-sdk/pm/state'
import pkg from 'lodash'
import { rmeDefaultKeymap } from './keymap'
const { cloneDeep } = pkg

export interface ShortcutConfig {
  [key: string]: string
}

export class ShortcutManager {
  private static instance: ShortcutManager
  private shortcuts: ShortcutConfig = {}

  private constructor() {
    this.shortcuts = cloneDeep(rmeDefaultKeymap)
  }

  public static getInstance(): ShortcutManager {
    if (!ShortcutManager.instance) {
      ShortcutManager.instance = new ShortcutManager()
    }
    return ShortcutManager.instance
  }

  public setShortcut(key: string, command: string): void {
    this.shortcuts[key] = command
  }

  public setShortcuts(shortcuts: ShortcutConfig): void {
    this.shortcuts = { ...this.shortcuts, ...shortcuts }
  }

  public getShortcuts(): ShortcutConfig {
    return this.shortcuts
  }

  public createKeyBindings(
    commands: ExtensionStore['commands'],
    config?: {
      disableAllBuildInShortcuts?: boolean
    },
  ) {
    const bindings: Record<string, Command> = {}

    Object.entries(this.shortcuts).forEach(([shortcut, command]) => {
      if (typeof commands[command] === 'function') {
        bindings[shortcut] = (state, dispatch, view) => {
          if (config?.disableAllBuildInShortcuts) {
            return true
          }

          commands[command](state, dispatch, view)
          return true
        }
      }
    })

    return bindings
  }
}
