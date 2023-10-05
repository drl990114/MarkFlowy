import type { IFile } from '@/helper/filesys'
import type { EditorViewType } from '@markflowy/editor'
import type { EditContentAction} from './reducers/edit-content'
import { editContent } from './reducers/edit-content'
import type { EditorInitAction} from './reducers/init-content'
import { initEditor } from './reducers/init-content'
import type { SaveContentAction} from './reducers/save-content'
import { saveContent } from './reducers/save-content'

type EditorAction = EditorInitAction | SaveContentAction | EditContentAction

function throwUnknownActionError(): never {
  throw new Error(`Unknown action type`)
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'INIT_ACTION':
      return initEditor(state, action)
    case 'SAVE_CONTENT':
      return saveContent(state, action)
    case 'EDIT_CONTENT':
      return editContent(state, action)
    default:
      throwUnknownActionError()
  }
}

export { editorReducer }

export function initializeState({
  note,
  file,
}: {
  note: Readonly<Note>
  file: IFile
}): EditorState {
  return {
    mode: 'wysiwyg',
    hasUnsavedChanges: false,
    note,
    file,
    loaded: false,
    saveedUndoDepth: 0,
  }
}

export interface Note {
  content: string
  deleted: boolean
}

export type EditorState = {
    mode: EditorViewType
    file: IFile
    note: Note
    hasUnsavedChanges: boolean
    saveedUndoDepth: number
    loaded: boolean
}

