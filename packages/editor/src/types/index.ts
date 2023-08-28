import type { AnyExtension, ProsemirrorNode, RemirrorManager } from "@remirror/core"


export type StringToDoc = (content: string) => ProsemirrorNode
export type DocToString = (doc: ProsemirrorNode) => string

export type EditorDelegate<E extends AnyExtension = any> = {
    manager: RemirrorManager<E>
    stringToDoc: StringToDoc
    docToString: DocToString
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
