import { extension, PlainExtension } from '@rme-sdk/sdk/core'
import { Plugin } from '@rme-sdk/sdk/pm/state'
import {
  createShortcutMatcher,
  protectAltGraphInput,
  shortcutAlternatives,
  type ShortcutMap,
  type ShortcutMatcherFactory,
} from './shortcut-matcher'

export const defaultEditorShortcuts: Record<string, string> = {
  copy: 'mod-c',
  cut: 'mod-x',
  undo: 'mod-z',
  redo: 'mod-Shift-z',
  toggleStrong: 'mod-b',
  toggleEmphasis: 'mod-i',
  toggleCodeText: 'mod-e',
  toggleDelete: 'mod-Shift-s',
  insertCurrentDate: 'mod-;',
  ...Object.fromEntries(
    Array.from({ length: 6 }, (_, index) => [`toggleH${index + 1}`, `mod-${index + 1}`]),
  ),
}

export interface KeyboardSettingsOptions {
  shortcuts: ShortcutMap
  createShortcutMatcher?: ShortcutMatcherFactory
}

/** Own only configurable command keys. Structural editing stays in the original extensions. */
@extension<KeyboardSettingsOptions>({
  defaultOptions: { shortcuts: {}, createShortcutMatcher },
  defaultPriority: 10000,
  staticKeys: [],
  handlerKeys: [],
  customHandlerKeys: [],
})
export class KeyboardSettingsExtension extends PlainExtension<KeyboardSettingsOptions> {
  get name() {
    return 'keyboardSettings' as const
  }

  createExternalPlugins() {
    let previous: ShortcutMap | undefined
    let previousFactory: ShortcutMatcherFactory | undefined
    let bindings: { matches: (event: KeyboardEvent) => boolean; run: () => boolean }[] = []
    return [
      new Plugin({
        view: (view) => ({ destroy: protectAltGraphInput(view.dom) }),
        props: {
          handleKeyDown: (view, event) => {
            if (
              event.defaultPrevented ||
              event.isComposing ||
              event.keyCode === 229 ||
              view.composing ||
              event.getModifierState?.('AltGraph')
            )
              return false
            const factory = this.options.createShortcutMatcher ?? createShortcutMatcher
            if (previous !== this.options.shortcuts || previousFactory !== factory) {
              previous = this.options.shortcuts
              previousFactory = factory
              bindings = []
              for (const [name, alternatives] of Object.entries(previous)) {
                if (name === 'paste') continue
                for (const key of shortcutAlternatives(alternatives)) {
                  if (
                    (name === 'copy' && key.toLowerCase() === 'mod-c') ||
                    (name === 'cut' && key.toLowerCase() === 'mod-x')
                  )
                    continue
                  const command = this.store.commands[name]
                  if (typeof command === 'function')
                    bindings.push({
                      matches: previousFactory(key),
                      run: () => {
                        if ((!view.editable && name !== 'copy') || !command.enabled()) return false
                        command()
                        return true
                      },
                    })
                }
              }
              // Suppress displaced configurable defaults only after active user rules.
              for (const [name, key] of Object.entries(defaultEditorShortcuts)) {
                if (name !== 'copy' && name !== 'cut')
                  bindings.push({ matches: previousFactory(key), run: () => true })
              }
              bindings.push({ matches: previousFactory('mod-y'), run: () => true })
            }
            return bindings.some(({ matches, run }) => matches(event) && run())
          },
        },
      }),
    ]
  }
}
