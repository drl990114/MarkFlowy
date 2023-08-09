import type { IFile } from '@/helper/filesys'
import type { EditorState, Note } from '@linebyline/editor/types'
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
    note: note,
    hasUnsavedChanges: false,
    file,
    loaded: false,
    saveedUndoDepth: 0,
  }
}
