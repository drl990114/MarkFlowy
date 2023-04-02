import { open, OpenDialogOptions } from '@tauri-apps/api/dialog'
import { readTextFile } from '@tauri-apps/api/fs'

const selectMdFile = async (opt?: OpenDialogOptions) => {
  const selectedPath = await open({
    multiple: false,
    filters: [
      {
        name: 'Open a md file',
        extensions: ['md'],
      },
    ],
    ...opt,
  })

  return selectedPath
}

const selectMdFileAndRead = async (): Promise<{ content: string; selectedPath: string } | undefined> => {
  const selectedPath = await selectMdFile() as string
  if (!selectedPath) return
  const content = await readTextFile(selectedPath as string)
  return {
    content,
    selectedPath,
  }
}

export default {
  selectMdFile,
  selectMdFileAndRead,
}
