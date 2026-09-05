import { create } from 'zustand'
import { EditorViewType, type EditorViewTypeValue } from '@/constants/editorViewType'
import { immer } from 'zustand/middleware/immer'

const useEditorViewTypeStore = create(
  immer<EditorViewTypeStore>((set, get) => {
    return {
      editorViewTypeMap: new Map(),

      setEditorViewType: (id, viewType) =>
        set((state) => {
          state.editorViewTypeMap.set(id, viewType)
          return state
        }),

      getEditorViewType: (id) => {
        const state = get()
        const viewType = state.editorViewTypeMap.get(id)
        if (viewType) {
          return viewType
        }
        return EditorViewType.PREVIEW
      },
    }
  }),
)

type EditorViewTypeStore = {
  editorViewTypeMap: Map<string, EditorViewTypeValue>
  setEditorViewType: (id: string, viewType: EditorViewTypeValue) => void
  getEditorViewType: (id: string) => EditorViewTypeValue
}

export default useEditorViewTypeStore
