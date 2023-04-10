import type { OpenDialogOptions } from '@tauri-apps/api/dialog'
import { open } from '@tauri-apps/api/dialog'
import { readTextFile } from '@tauri-apps/api/fs'

async function selectMdFile(opt?: OpenDialogOptions) {
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

async function selectMdFileAndRead(): Promise<{ content: string; selectedPath: string } | undefined> {
  const selectedPath = await selectMdFile() as string
  if (!selectedPath)
    return
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
