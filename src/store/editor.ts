import { create } from 'zustand'

const useEditorStore = create((set) => ({
  editorInstance: null,
  setMarkdown: () => set((state) => ({ bears: state.bears + 1 })),
  getMarkdown: () => set((state) => ({ bears: state.bears + 1 })),
}))

export default useEditorStore
