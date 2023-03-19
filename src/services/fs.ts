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
    ...opt
  })

  return selectedPath
}

const selectMdFileAndRead = async () => {
  const selectedPath = await selectMdFile()
  if (!selectedPath) return
  const content = readTextFile(selectedPath as string)
  console.log('selectMdFileAndRead', content)
}

export default {
  selectMdFile,
  selectMdFileAndRead,
}
