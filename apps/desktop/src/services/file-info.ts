import { invoke } from '@tauri-apps/api/core'

export const getFileContent = async (params: { filePath?: string }) => {
  const { filePath } = params
  if (!filePath) {
    return null
  }
  const isExists = await invoke('file_exists', { filePath })
  if (isExists) {
    const text = await invoke<string>('get_file_content', {
      filePath,
    })
    return text
  } else {
    return null
  }
}
