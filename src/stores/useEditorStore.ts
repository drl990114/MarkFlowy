import type { FileEntry } from '@tauri-apps/api/fs'
import { create } from 'zustand'

const useEditorStore = create<EditorStore>(set => ({
  folderData: null,
  setFolderData: folderData => set(state => ({ folderData })),
}))

interface EditorStore {
  folderData: null | FileEntry[]
  setFolderData: (folderData: FileEntry[]) => void
}

export default useEditorStore
