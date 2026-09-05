import { create } from 'zustand'

const useEditorCounterStore = create<EditorCountStore>((set) => {
  return {
    editorCounterMap: {},

    addEditorCounter: ({ id, data }) => {
      set((state) => {
        const previous = state.editorCounterMap[id]
        if (
          previous?.characterCount === data.characterCount &&
          previous.nonWhitespaceCharacterCount === data.nonWhitespaceCharacterCount &&
          previous.wordCount === data.wordCount
        ) return state

        return {
          ...state,
          editorCounterMap: {
            ...state.editorCounterMap,
            [id]: data,
          },
        }
      })
    },

    deleteEditorCounter: ({ id }) => {
      set((state) => {
        const newEditorCountMap = { ...state.editorCounterMap }
        delete newEditorCountMap[id]
        return {
          ...state,
          editorCounterMap: newEditorCountMap,
        }
      })
    },
  }
})

interface EditorCountStore {
  editorCounterMap: EditorCounterMap
  addEditorCounter: (params: { id: string; data: EditorCounterData }) => void
  deleteEditorCounter: (params: { id: string }) => void
}

export default useEditorCounterStore

type EditorCounterMap = Record<string, EditorCounterData>

interface EditorCounterData {
  characterCount: number
  nonWhitespaceCharacterCount: number
  wordCount: number
}
