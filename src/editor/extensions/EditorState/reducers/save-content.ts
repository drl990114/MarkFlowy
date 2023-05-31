import { EditorState } from '../../../types'

export type SaveContentAction = {
  type: 'SAVE_CONTENT'
  payload: {
    content: string
    undoDepth: number
  }
}

export function saveContent(state: EditorState, action: SaveContentAction): EditorState {
  return { ...state, note: { content: action.payload.content, deleted: state.note.deleted }, saveedUndoDepth: action.payload.undoDepth, hasUnsavedChanges: false }
}
