import { useCommandStore } from '@/stores'
import { useEffect } from 'react'
import useOpen from './useOpen'

export const useCommandInit = () => {
  const { openFolderDialog } = useOpen()
  const { addCommand } = useCommandStore()

  useEffect(() => {
    addCommand({ id: 'app:open_folder', handler: openFolderDialog })
  }, [addCommand, openFolderDialog])
}
