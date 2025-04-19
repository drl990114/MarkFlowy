import { FileResultCode, FileSysResult } from '@/helper/filesys'
import { invoke } from '@tauri-apps/api/core'

export const getFileContent = async (params: { filePath?: string }) => {
  const { filePath } = params
  if (!filePath) {
    return null
  }
  const isExists = await invoke('file_exists', { filePath })
  if (isExists) {
    const res = await invoke<FileSysResult>('get_file_content', {
      filePath,
    })
    if (res.code !== FileResultCode.Success) {
      return null
    }
    return res.content
  } else {
    return null
  }
}
