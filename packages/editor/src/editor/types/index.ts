import type { AnyExtension, RemirrorManager } from '@rme-sdk/core'
import type { Node } from '@rme-sdk/pm/model'
import type { ReactFrameworkOutput } from '@rme-sdk/react-core'

export type StringToDoc = (content: string) => Node
export type DocToString = (doc: Node) => string

export type EditorDelegate<E extends AnyExtension = any> = {
  manager: RemirrorManager<E>
  stringToDoc: StringToDoc
  docToString: DocToString
  view: 'SourceCode' | 'Wysiwyg'
}

/** @public */
export interface Note {
  content: string
  deleted: boolean
}

export enum EditorViewType {
  WYSIWYG = 'wysiwyg',
  SOURCECODE = 'sourceCode',
  PREVIEW = 'preview',
}

type BaseEditorState = {
  mode: EditorViewType
  delegate?: EditorDelegate
  note: Note
  hasUnsavedChanges: boolean
  saveedUndoDepth: number
  loaded: boolean
}

export type EditorState = BaseEditorState

export type EditorContext = ReactFrameworkOutput<Remirror.Extensions>
