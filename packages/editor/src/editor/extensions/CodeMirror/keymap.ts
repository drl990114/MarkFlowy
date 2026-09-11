import { redo, undo } from '@codemirror/commands'
import type { KeyBinding } from '@codemirror/view'
import { isBrowser } from '../../utils/common'
import type { ClipboardReadFunction } from './../../utils/clipboard-read'
import type { CurrentDateFormatOption } from '../../utils/date'
import { shortcutAlternatives, type ShortcutMatcherFactory } from '../Shortcuts/shortcut-matcher'
import {
  applyBold,
  applyCode,
  applyH1,
  applyH2,
  applyH3,
  applyH4,
  applyH5,
  applyH6,
  applyItalic,
  applyStrikethrough,
  getInsertLinkOrImageCommand,
  insertCurrentDate,
} from './commands/markdown'

export interface CommandKeymapOptions {
  /**
   * Override default keyboard shortcuts
   * @example
   * { toggleStrong: 'mod-shift-b', toggleEmphasis: 'ctrl-i' }
   */
  overrideShortcutMap?: Partial<Record<CommandName, string | readonly string[]>>

  /**
   * Disable all built-in shortcuts
   * @default false
   */
  disableAllBuildInShortcuts?: boolean

  clipboardReadFunction?: ClipboardReadFunction

  currentDateFormat?: CurrentDateFormatOption

  createShortcutMatcher?: ShortcutMatcherFactory
}

export type CommandName = keyof typeof defaultCommandShortcutMap

export const defaultCommandShortcutMap = {
  copy: 'mod-c',
  paste: 'mod-v',
  undo: 'mod-z',
  redo: 'mod-shift-z',
  cut: 'mod-x',
  toggleH1: 'mod-1',
  toggleH2: 'mod-2',
  toggleH3: 'mod-3',
  toggleH4: 'mod-4',
  toggleH5: 'mod-5',
  toggleH6: 'mod-6',
  toggleStrong: 'mod-b',
  toggleEmphasis: 'mod-i',
  toggleCodeText: 'mod-e',
  toggleDelete: 'mod-shift-s',
  insertLink: 'mod-k',
  insertImage: 'mod-alt-i',
  insertCurrentDate: 'mod-;',
} as const

/**
 * Create command keymap with configurable shortcuts
 */
export function createCommandKeymap(
  options: CommandKeymapOptions = {},
  historyCommands: {
    undo: NonNullable<KeyBinding['run']>
    redo: NonNullable<KeyBinding['run']>
  } = { undo, redo },
): KeyBinding[] {
  const { overrideShortcutMap = {}, disableAllBuildInShortcuts = false } = options

  // Start with empty keymap if all built-ins are disabled
  const shortcutMap: Partial<Record<CommandName, string | readonly string[]>> =
    disableAllBuildInShortcuts ? {} : { ...defaultCommandShortcutMap }

  // Apply user overrides
  Object.assign(shortcutMap, overrideShortcutMap)

  const keymap: KeyBinding[] = []
  const add = (
    command: CommandName,
    run: NonNullable<KeyBinding['run']>,
    preventDefault = false,
  ) => {
    for (const key of shortcutAlternatives(shortcutMap[command] ?? [])) {
      // Native clipboard events own the standard bindings and retain their selection semantics.
      if (
        (command === 'copy' && key.toLowerCase() === 'mod-c') ||
        (command === 'cut' && key.toLowerCase() === 'mod-x')
      )
        continue
      keymap.push({ key, run, preventDefault })
    }
  }

  add('undo', historyCommands.undo, true)
  add('redo', historyCommands.redo, true)
  add('toggleStrong', applyBold)
  add('toggleEmphasis', applyItalic)
  add('toggleCodeText', applyCode)
  add('toggleDelete', applyStrikethrough)
  add('insertLink', getInsertLinkOrImageCommand({ type: 'link', options }))
  add('insertImage', getInsertLinkOrImageCommand({ type: 'image', options }))
  add('insertCurrentDate', (view) => insertCurrentDate(view, options.currentDateFormat))
  add('toggleH1', applyH1)
  add('toggleH2', applyH2)
  add('toggleH3', applyH3)
  add('toggleH4', applyH4)
  add('toggleH5', applyH5)
  add('toggleH6', applyH6)
  add('copy', () => isBrowser() && document.execCommand('copy'))
  add('cut', () => isBrowser() && document.execCommand('cut'))

  if (disableAllBuildInShortcuts) {
    const active = new Set(keymap.map((binding) => binding.key?.toLowerCase()))
    for (const [command, key] of Object.entries(defaultCommandShortcutMap)) {
      if (['copy', 'cut', 'paste'].includes(command) || active.has(key.toLowerCase())) continue
      keymap.push({ key, run: () => true, preventDefault: true })
    }
    if (!active.has('mod-y')) keymap.push({ key: 'mod-y', run: () => true, preventDefault: true })
  }
  return keymap
}
