import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { FileTypeConfig } from '@/helper/fileTypeHandler'

const useFileTypeConfigStore = create(
  immer<FileTypeConfigStore>((set, get) => {
    return {
      fileTypeConfigMap: new Map(),

      setFileTypeConfig: (id, fileTypeConfig) =>
        set((state) => {
          state.fileTypeConfigMap.set(id, fileTypeConfig)
          return state
        }),

      getFileTypeConfigById: (id) => {
        const state = get()
        const fileTypeConfig = state.fileTypeConfigMap.get(id)
        if (fileTypeConfig) {
          return fileTypeConfig
        }
        return null
      },
    }
  }),
)

type FileTypeConfigStore = {
  fileTypeConfigMap: Map<string, FileTypeConfig>
  setFileTypeConfig: (id: string, fileTypeConfig: FileTypeConfig) => void
  getFileTypeConfigById: (id: string) => FileTypeConfig | null
}

export default useFileTypeConfigStore
