import { redo, undo } from '@codemirror/commands'
import { KeyBinding } from '@codemirror/view'
import { clipboardRead } from '../../utils/clipboard-read'
import { isBrowser } from '../../utils/common'
import { ClipboardReadFunction } from './../../utils/clipboard-read'
import { CurrentDateFormatOption } from '../../utils/date'
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
  overrideShortcutMap?: Partial<Record<CommandName, string>>

  /**
   * Disable all built-in shortcuts
   * @default false
   */
  disableAllBuildInShortcuts?: boolean

  clipboardReadFunction?: ClipboardReadFunction

  currentDateFormat?: CurrentDateFormatOption
}

export type CommandName = keyof typeof defaultCommandShortcutMap

const defaultCommandShortcutMap = {
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
export function createCommandKeymap(options: CommandKeymapOptions = {}): KeyBinding[] {
  const { overrideShortcutMap = {}, disableAllBuildInShortcuts = false } = options

  // Start with empty keymap if all built-ins are disabled
  let shortcutMap: Partial<Record<CommandName, string>> = disableAllBuildInShortcuts
    ? {}
    : { ...defaultCommandShortcutMap }

  // Apply user overrides
  Object.assign(shortcutMap, overrideShortcutMap)

  // if (shortcutMap?.paste?.toLowerCase() === 'mod-v') {
  delete shortcutMap.paste
  // }

  const keymap: KeyBinding[] = []

  // Add undo/redo commands
  if (shortcutMap.undo) {
    keymap.push({ key: shortcutMap.undo, run: undo, preventDefault: true })
  }
  if (shortcutMap.redo) {
    keymap.push({ key: shortcutMap.redo, run: redo, preventDefault: true })
  }

  // Add markdown formatting commands
  if (shortcutMap.toggleStrong) {
    keymap.push({ key: shortcutMap.toggleStrong, run: applyBold })
  }
  if (shortcutMap.toggleEmphasis) {
    keymap.push({ key: shortcutMap.toggleEmphasis, run: applyItalic })
  }
  if (shortcutMap.toggleCodeText) {
    keymap.push({ key: shortcutMap.toggleCodeText, run: applyCode })
  }
  if (shortcutMap.toggleDelete) {
    keymap.push({ key: shortcutMap.toggleDelete, run: applyStrikethrough })
  }

  if (shortcutMap.insertLink) {
    keymap.push({
      key: shortcutMap.insertLink,
      run: getInsertLinkOrImageCommand({ type: 'link', options }),
    })
  }
  if (shortcutMap.insertImage) {
    keymap.push({
      key: shortcutMap.insertImage,
      run: getInsertLinkOrImageCommand({ type: 'image', options }),
    })
  }
  if (shortcutMap.insertCurrentDate) {
    keymap.push({
      key: shortcutMap.insertCurrentDate,
      run: (view) => insertCurrentDate(view, options.currentDateFormat),
    })
  }

  // Add heading commands
  if (shortcutMap.toggleH1) {
    keymap.push({ key: shortcutMap.toggleH1, run: applyH1 })
  }
  if (shortcutMap.toggleH2) {
    keymap.push({ key: shortcutMap.toggleH2, run: applyH2 })
  }
  if (shortcutMap.toggleH3) {
    keymap.push({ key: shortcutMap.toggleH3, run: applyH3 })
  }
  if (shortcutMap.toggleH4) {
    keymap.push({ key: shortcutMap.toggleH4, run: applyH4 })
  }
  if (shortcutMap.toggleH5) {
    keymap.push({ key: shortcutMap.toggleH5, run: applyH5 })
  }
  if (shortcutMap.toggleH6) {
    keymap.push({ key: shortcutMap.toggleH6, run: applyH6 })
  }

  // Add other commands
  if (shortcutMap.copy) {
    keymap.push({
      key: shortcutMap.copy,
      run: (view) => {
        // 处理复制操作
        if (isBrowser()) {
          document.execCommand('copy')
        }
        return true
      },
      preventDefault: true,
    })
  }
  if (shortcutMap.paste) {
    keymap.push({
      key: shortcutMap.paste,
      run: (view) => {
        const clipboardReadFn = options.clipboardReadFunction || clipboardRead

        clipboardReadFn()
          .then(({ text }) => {
            if (text && view) {
              const textToInsert = typeof text === 'string' ? text : ''
              const insertPosition = view.state.selection.main.from
              const newCursorPosition = insertPosition + textToInsert.length

              view.dispatch({
                changes: {
                  from: view.state.selection.main.from,
                  to: view.state.selection.main.to,
                  insert: textToInsert,
                },
                selection: { anchor: newCursorPosition, head: newCursorPosition },
              })
            }
          })
          .catch((error) => {
            console.error('Failed to read clipboard:', error)
          })

        return true // 返回true表示命令已处理
      },
      preventDefault: true,
    })
  }
  if (shortcutMap.cut) {
    keymap.push({
      key: shortcutMap.cut,
      run: (view) => {
        if (isBrowser()) {
          document.execCommand('cut')
        }
        return true
      },
      preventDefault: true,
    })
  }

  return keymap
}
