import type { IFile } from "@/helper/filesys"
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

export type EditorViewType = 'wysiwyg' | 'dual'

type BaseEditorState = {
    mode: EditorViewType
    delegate?: EditorDelegate
    note: Note
    file: IFile
    hasUnsavedChanges: boolean
    saveedUndoDepth: number
    loaded: boolean
}

export type EditorState = BaseEditorState
