import { create } from 'zustand'

const useEditorStore = create((set) => ({
  editorInstance: null,
}))

export default useEditorStore
