import { EditorView, extension, PlainExtension } from '@rme-sdk/core'
import { keymap } from '@rme-sdk/pm/keymap'
import { ShortcutManager } from './configs/shortcuts'

type ShortcutsExtensionOptions = {
  shortcuts?: { [key: string]: string }
  disableAllBuildInShortcuts?: boolean
}

@extension<ShortcutsExtensionOptions>({
  defaultOptions: {
    shortcuts: undefined,
    disableAllBuildInShortcuts: false,
  },
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class ShortcutsExtension extends PlainExtension<ShortcutsExtensionOptions> {
  get name() {
    return 'shortcuts' as const
  }

  createExternalAPI() {
    return {
      setShortcut: (key: string, command: string) => {
        ShortcutManager.getInstance().setShortcut(key, command)
      },
      setShortcuts: (shortcuts: { [key: string]: string }) => {
        ShortcutManager.getInstance().setShortcuts(shortcuts)
      },
      getShortcuts: () => {
        return ShortcutManager.getInstance().getShortcuts()
      },
    }
  }

  onCreate() {
    if (this.options.shortcuts) {
      ShortcutManager.getInstance().setShortcuts(this.options.shortcuts)
    }
  }

  onView(view: EditorView) {
    const keyBinds = ShortcutManager.getInstance().createKeyBindings(this.store.commands, {
      disableAllBuildInShortcuts: this.options.disableAllBuildInShortcuts,
    })

    const newState = view.state.reconfigure({
      plugins: [...view.state.plugins, keymap(keyBinds)],
    })

    view.updateState(newState)
  }
}
