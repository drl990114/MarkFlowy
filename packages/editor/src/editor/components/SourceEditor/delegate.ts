import { markdown } from '@codemirror/lang-markdown'
import { CountExtension } from '@rme-sdk/extension-count'
import type { RemirrorManager } from '@rme-sdk/main'
import { DocExtension } from '@rme-sdk/main/extensions'
import { createReactManager } from '@rme-sdk/react'
import { MfCodemirrorView } from '../../codemirror/codemirror'
import { LineCodeMirrorExtension } from '../../extensions/CodeMirror/codemirror-extension'
import { CommandName } from '../../extensions/CodeMirror/keymap'
import { basicSetup } from '../../extensions/CodeMirror/setup'
import { TypewriterScrollExtension, TypewriterScrollOptions } from '../../extensions/TypewriterScroll'
import type { DocToString, EditorDelegate, StringToDoc } from '../../types'
import { ClipboardReadFunction } from '../../utils/clipboard-read'
import { CurrentDateFormatOption } from '../../utils/date'
import { FindExtension } from '@/editor/extensions/Find/find-extension'

type CreateSourceCodeManagerOptions = {
  language?: string
  onCodemirrorViewLoad: (cm: MfCodemirrorView) => void
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

  typewriterScroll?: TypewriterScrollOptions

  currentDateFormat?: CurrentDateFormatOption
}
export function createSourceCodeManager(
  options?: CreateSourceCodeManagerOptions,
): RemirrorManager<any> {
  const typewriterScrollOptions = options?.typewriterScroll ?? {}
  const typewriterScrollExtension = new TypewriterScrollExtension(typewriterScrollOptions)
  const typewriterCmExtension = [typewriterScrollExtension.createCodeMirrorExtension()]

  return createReactManager(() => [
    new CountExtension({}),
    new DocExtension({ content: 'codeMirror' }),
    new FindExtension({}),
    new LineCodeMirrorExtension({
      hideDecoration: true,
      showCopyButton: false,
      extensions: [basicSetup, markdown(), ...typewriterCmExtension],
      onCodemirrorViewLoad: options?.onCodemirrorViewLoad,
      commandKeymapOptions: {
        overrideShortcutMap: options?.overrideShortcutMap,
        disableAllBuildInShortcuts: options?.disableAllBuildInShortcuts,
        clipboardReadFunction: options?.clipboardReadFunction,
        currentDateFormat: options?.currentDateFormat,
      }
    }),
    typewriterScrollExtension,
  ])
}

export const createSourceCodeDelegate = (
  options?: CreateSourceCodeManagerOptions,
): EditorDelegate<any> => {
  const manager = createSourceCodeManager(options)

  const stringToDoc: StringToDoc = (content: string) => {
    const schema = manager.schema
    const attrs = { language: options?.language || 'markdown' }
    const child = content ? schema.text(content) : undefined
    return schema.nodes.doc.create({}, schema.nodes.codeMirror.create(attrs, child))
  }

  const docToString: DocToString = (doc) => {
    return doc.textContent
  }

  return { manager, stringToDoc, docToString, view: 'SourceCode' }
}
