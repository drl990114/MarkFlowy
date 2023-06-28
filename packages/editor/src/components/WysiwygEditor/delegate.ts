import { createReactManager } from '@remirror/react'
import { initDocMarks } from '../../extensions/Inline'
import type { AnyExtension } from 'remirror'
import type { RemirrorManager } from '@remirror/core'
import { isExtension } from '@remirror/core'
import type { MarkdownNodeExtension } from '../../extensions'
import type { ParserRule, NodeSerializerSpecs } from '../../transform'
import { MarkdownParser, MarkdownSerializer } from '../../transform'
import type { StringToDoc, DocToString, EditorDelegate } from '../../../types'
import EditorExtensions from '../../extensions'
import "prosemirror-flat-list/dist/style.css"

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

export const createWysiwygDelegate = (): EditorDelegate<any>=> {
  const manager = createReactManager(EditorExtensions)
  const parser = buildMarkdownParser(manager)
  const serializer = buildMarkdownSerializer(manager)

  const stringToDoc: StringToDoc = (content) => {
    const doc = parser.parse(content)

    return initDocMarks(doc)
  }

  const docToString: DocToString = (doc) => {
    return serializer.serialize(doc)
  }

  return {
    manager,
    stringToDoc,
    docToString,
  }
}
