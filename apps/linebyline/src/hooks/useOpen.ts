import { useCallback } from 'react'
import { open } from '@tauri-apps/api/dialog'
import { readDirectory } from '@/helper/filesys'
import { CacheManager } from '@/helper'
import { useEditorStore } from '@/stores'
import dayjs from 'dayjs'

const useOpen = () => {
  const { setFolderData } = useEditorStore()

  const openFolder = useCallback(
    async (dir: string) => {
      try {
        const res = await readDirectory(dir)
        CacheManager.writeCache('openFolderHistory', { path: dir, time: dayjs() })
        setFolderData(res)
      } catch (error) {
        console.error('error', error)
      }
    },
    [setFolderData],
  )

  const openFolderDialog = useCallback(async () => {
    const dir = await open({ directory: true, recursive: true })

    if (typeof dir !== 'string') return
    openFolder(dir)
  }, [openFolder])

  return {
    openFolderDialog,
    openFolder
  }
}

export default useOpen
