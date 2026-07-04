import type { RemirrorManager } from '@rme-sdk/core'
import { isExtension } from '@rme-sdk/core'
import type { AnyExtension } from '@rme-sdk/main'
import type { Node } from '@rme-sdk/pm/model'
import { createReactManager } from '@rme-sdk/react'
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
  const defaultOverrideShortcutMap = {
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
    insertCurrentDate: 'mod-;',
  }

  const overrideShortcutMap = {
    ...(options.overrideShortcutMap || {}),
  }

  if (!options.disableAllBuildInShortcuts) {
    Object.assign(overrideShortcutMap, defaultOverrideShortcutMap)
  }

  // if (overrideShortcutMap?.paste?.toLowerCase() === 'mod-v') {
  delete overrideShortcutMap.paste
  // }

  const manager = createReactManager(
    () => {
      return [...EditorExtensions(options)]
    },
    {
      builtin: {
        overrideShortcutMap,
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
