import { useCommandStore } from '@/stores'
import { useEffect } from 'react'
import useOpen from './useOpen'

export const useCommandInit = () => {
  const { openFolderDialog } = useOpen()

  useEffect(() => {
    useCommandStore.getState().addCommand({ id: 'app:open_folder', handler: openFolderDialog })
  }, [openFolderDialog])
}
