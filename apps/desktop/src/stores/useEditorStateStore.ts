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
  delIdStateMap: (id: string) => void
}

const useEditorStateStore = create(
  immer<EditorStateStoreState & EditorStateStoreAction>((set, get) => ({
    idStateMap: new Map(),

    setIdStateMap: (id, editorState) => {
      const previous = get().idStateMap.get(id)
      if (
        previous?.hasUnsavedChanges === editorState.hasUnsavedChanges &&
        previous.undoDepth === editorState.undoDepth
      ) return

      set((state) => {
        state.idStateMap?.set(id, editorState)
      })
    },

    delIdStateMap: (id) =>
      set((state) => {
        if (state.idStateMap.has(id)) {
          state.idStateMap.delete(id)
        }
      }),
  })),
)

export default useEditorStateStore
