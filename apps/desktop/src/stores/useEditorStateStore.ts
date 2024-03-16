import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type EditorState = {
  hasUnsavedChanges: boolean
  undoDepth?: number
}

type EditorStateStoreState = {
  idStateMap: Map<string, EditorState>
}

type EditorStateStoreAction = {
  setIdStateMap: (id: string, editorState: EditorState) => void
}

const useEditorStateStore = create(
  immer<EditorStateStoreState & EditorStateStoreAction>((set) => ({
    idStateMap: new Map(),

    setIdStateMap: (id, editorState) => {
      set((state) => {
        state.idStateMap?.set(id, editorState)
      })
    },
  })),
)

export default useEditorStateStore
