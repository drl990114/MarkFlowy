import { useCallback } from 'react'
import { open } from '@tauri-apps/api/dialog'
import { readDirectory } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'

const useOpen = () => {
  const { setFolderData } = useEditorStore()
  const { addRecentWorkspaces } = useOpenedCacheStore()

  const openFolder = useCallback(
    async (dir: string) => {
      try {
        const res = await readDirectory(dir)
        addRecentWorkspaces({ path: dir })
        setFolderData(res)
      } catch (error) {
        console.error('error', error)
      }
    },
    [addRecentWorkspaces, setFolderData],
  )

  const openFolderDialog = useCallback(async () => {
    const dir = await open({ directory: true, recursive: true })

    if (typeof dir !== 'string') return
    openFolder(dir)
  }, [openFolder])

  return {
    openFolderDialog,
    openFolder,
  }
}

export default useOpen
