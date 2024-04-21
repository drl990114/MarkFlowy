import { create } from 'zustand'
import type { EditorViewType } from 'rme'
import { immer } from 'zustand/middleware/immer'

const useEditorViewTypeStore = create(
  immer<EditorViewTypeStore>((set) => {
    return {
      editorViewTypeMap: new Map(),

      setEditorViewType: (id, viewType) =>
        set((state) => {
          state.editorViewTypeMap.set(id, viewType)
          return state
        }),
    }
  }),
)

type EditorViewTypeStore = {
  editorViewTypeMap: Map<string, EditorViewType>
  setEditorViewType: (id: string, viewType: EditorViewType) => void
}

export default useEditorViewTypeStore
