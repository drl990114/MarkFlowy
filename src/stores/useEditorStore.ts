import { FileEntry } from '@tauri-apps/api/fs'
import { create } from 'zustand'

const useEditorStore = create<EditorStore>((set) => ({
  editors: null,
  folderData: null,
  setFolderData: (folderData) => set((state) => ({ folderData })),
}))

interface EditorStore {
  editors: null
  folderData: null | FileEntry[]
  setFolderData: (folderData: FileEntry[]) => void
}

export default useEditorStore
