import type { AnyExtension, RemirrorManager } from "@remirror/core"
import type { ReactFrameworkOutput } from "@remirror/react-core"
import type {  Node } from '@remirror/pm/model'

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

export type EditorViewType = 'wysiwyg' | 'sourceCode'

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
