import { createReactManager } from '@remirror/react'
import type { StringToDoc, DocToString, EditorDelegate } from '../../types'
import { DocExtension } from 'remirror/extensions'
import type { RemirrorManager } from 'remirror'
import { LineCodeMirrorExtension } from '../../extensions/CodeMirror/codemirror-extension'
import { markdown } from '@codemirror/lang-markdown'
import { basicSetup } from '../../extensions/CodeMirror/setup'
import { CountExtension } from '@remirror/extension-count'

export function createSourceCodeManager(): RemirrorManager<any> {
  return createReactManager(() => [
    new CountExtension({}),
    new DocExtension({ content: 'codeMirror' }),
    new LineCodeMirrorExtension({
      hideDecoration: true,
      extensions: [basicSetup, markdown()],
    }),
  ])
}

export const createSourceCodeDelegate = (): EditorDelegate<any> => {
  const manager = createSourceCodeManager()

  const stringToDoc: StringToDoc = (content: string) => {
    const schema = manager.schema
    const attrs = { language: 'markdown' }
    const child = content ? schema.text(content) : undefined
    return schema.nodes.doc.create({}, schema.nodes.codeMirror.create(attrs, child))
  }

  const docToString: DocToString = (doc) => {
    return doc.textContent
  }

  return { manager, stringToDoc, docToString, view: 'SourceCode' }
}
