import { IFile } from '@/utils/filesys'
import { create } from 'zustand'

const useEditorStore = create<EditorStore>(set => ({
  folderData: null,
  setFolderData: folderData => set(state => ({ folderData })),
}))

interface EditorStore {
  folderData: null | IFile[]
  setFolderData: (folderData: IFile[]) => void
}

export default useEditorStore
