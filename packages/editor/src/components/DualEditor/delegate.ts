import { createReactManager } from '@remirror/react'
import type { StringToDoc, DocToString, EditorDelegate } from '../../../types'
import { CodeMirrorExtension } from '@remirror/extension-codemirror6'
import { DocExtension } from 'remirror/extensions'
import type { RemirrorManager } from 'remirror'

export function createSourceCodeManager(): RemirrorManager<any> {
  return createReactManager(() => [
    new DocExtension({ content: 'codeMirror' }),
    new CodeMirrorExtension(),
  ])
}

export const createDualDelegate = (): EditorDelegate<any> => {
  const manager = createSourceCodeManager()

  const stringToDoc: StringToDoc = (content) => {
    const schema = manager.schema
    const attrs = { language: 'markdown' }
    const child = content ? schema.text(content) : undefined
    return schema.nodes.doc.create({}, schema.nodes.codeMirror.create(attrs, child))
  }

  const docToString: DocToString = (doc) => {
    return doc.textContent
  }

  return { manager, stringToDoc, docToString }
}
