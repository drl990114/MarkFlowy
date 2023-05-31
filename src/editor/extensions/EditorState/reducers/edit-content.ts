import { EditorState } from '../../../types'

export type EditContentAction = {
  type: 'EDIT_CONTENT'
  payload: {
    undoDepth: number
  }
}

export function editContent(state: EditorState, action: EditContentAction): EditorState {
  let hasUnsavedChanges = false
  if (state.saveedUndoDepth - action.payload.undoDepth !== 0) {
    hasUnsavedChanges = true
  }
  return { ...state, hasUnsavedChanges }
}
