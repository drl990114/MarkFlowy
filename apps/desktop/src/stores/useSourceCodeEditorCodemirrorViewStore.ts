import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

const useSourceCodeEditorCodemirrorViewStore = create(
  immer<EditorViewTypeStore>((set) => {
    return {
      sourceCodeCodemirrorViewMap: new Map(),

      setSourceCodeCodemirrorView: (id, viewType) =>
        set((state) => {
          state.sourceCodeCodemirrorViewMap.set(id, viewType)
          return state
        }),
    }
  }),
)


type EditorViewTypeStore = {
  sourceCodeCodemirrorViewMap: Map<string, any>
  setSourceCodeCodemirrorView: (id: string, viewType: any) => void
}

export default useSourceCodeEditorCodemirrorViewStore
