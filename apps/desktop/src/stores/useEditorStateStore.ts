import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

type EditorStateStoreState = {
  idStateMap: Map<string, any>
}

type EditorStateStoreAction = {
  setIdStateMap: (id: string, editorState: any) => void
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
