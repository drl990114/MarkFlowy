import { createReactManager } from '@remirror/react'
import type { StringToDoc, DocToString, EditorDelegate } from '../../../types'
import { DocExtension } from 'remirror/extensions'
import type { RemirrorManager } from 'remirror'
import { LineCodeMirrorExtension } from '../../extensions/CodeMIrror/codemirror-extension'
import { lineNumbers, EditorView } from '@codemirror/view'
import { githubLight } from '@uiw/codemirror-theme-github'
import { markdown } from '@codemirror/lang-markdown'

export function createSourceCodeManager(): RemirrorManager<any> {
  return createReactManager(() => [
    new DocExtension({ content: 'codeMirror' }),
    new LineCodeMirrorExtension({ extensions: [githubLight, lineNumbers(), EditorView.lineWrapping, markdown()]}),
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
