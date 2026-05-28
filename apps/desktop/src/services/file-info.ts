import { FileResultCode, FileSysResult } from '@/helper/filesys'
import { invoke } from '@tauri-apps/api/core'

export const getFileContent = async (params: { filePath?: string }) => {
  const { filePath } = params
  if (!filePath) {
    return null
  }
  const res = await invoke<FileSysResult>('get_file_content', {
    filePath,
  })
  if (res.code !== FileResultCode.Success) {
    return null
  }
  return res.content
}
