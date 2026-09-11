import {
  KeyboardSettingsExtension,
  defaultEditorShortcuts,
} from '../../extensions/Shortcuts/keyboard-settings-extension'
import type { RemirrorManager } from '@rme-sdk/sdk/core'
import { isExtension } from '@rme-sdk/sdk/core'
import type { AnyExtension } from '@rme-sdk/sdk'
import type { Node } from '@rme-sdk/sdk/pm/model'
import { createReactManager } from '@rme-sdk/sdk/react'
import type { ExtensionsOptions, MarkdownNodeExtension } from '../../extensions'
import EditorExtensions from '../../extensions'
import { initDocMarks } from '../../extensions/Inline'
import type { NodeSerializerSpecs, ParserRule } from '../../transform'
import { MarkdownParser, MarkdownSerializer } from '../../transform'
import type { DocToString, EditorDelegate, StringToDoc } from '../../types'

function isMarkdownNodeExtension(extension: unknown): extension is MarkdownNodeExtension {
  return !!(
    isExtension(extension) &&
    (extension as unknown as MarkdownNodeExtension).fromMarkdown &&
    (extension as unknown as MarkdownNodeExtension).toMarkdown
  )
}

export function buildMarkdownParser<Extension extends AnyExtension>(
  manager: RemirrorManager<Extension>,
) {
  const parserRules: ParserRule[] = []
  for (const extension of manager.extensions) {
    if (isMarkdownNodeExtension(extension)) {
      parserRules.push(...extension.fromMarkdown())
    }
  }
  return new MarkdownParser(manager.schema, parserRules)
}

export function buildMarkdownSerializer<Extension extends AnyExtension>(
  manager: RemirrorManager<Extension>,
) {
  const specs: NodeSerializerSpecs = {}
  for (const extension of manager.extensions) {
    if (isMarkdownNodeExtension(extension)) {
      specs[extension.name] = extension.toMarkdown
    }
  }
  return new MarkdownSerializer(specs)
}

export type CreateWysiwygDelegateOptions = ExtensionsOptions

export const createWysiwygDelegate = (
  options: CreateWysiwygDelegateOptions = {},
): EditorDelegate<any> => {
  const overrideShortcutMap = {
    ...(options.disableAllBuildInShortcuts ? {} : defaultEditorShortcuts),
    ...options.overrideShortcutMap,
  }

  const customSelectAllShortcut = overrideShortcutMap.selectAll
  if (customSelectAllShortcut) {
    // RME applies command overrides after extension keymaps. Route a custom
    // select-all shortcut through the table-aware command at that final layer.
    overrideShortcutMap.selectAllInStages = customSelectAllShortcut
    delete overrideShortcutMap.selectAll
  }

  // if (overrideShortcutMap?.paste?.toLowerCase() === 'mod-v') {
  delete overrideShortcutMap.paste
  // }

  const manager = createReactManager(
    () => {
      return [
        new KeyboardSettingsExtension({ shortcuts: overrideShortcutMap }),
        ...EditorExtensions(options),
      ]
    },
    {
      builtin: {
        overrideShortcutMap: {},
      },
    },
  )

  const parser = buildMarkdownParser(manager)
  const serializer = buildMarkdownSerializer(manager)

  const stringToDoc: StringToDoc = (content: string) => {
    const doc = parser.parse(content)
    return initDocMarks(doc)
  }

  const docToString: DocToString = (doc: Node) => {
    return serializer.serialize(doc)
  }

  return {
    view: 'Wysiwyg',
    manager,
    stringToDoc,
    docToString,
  }
}
