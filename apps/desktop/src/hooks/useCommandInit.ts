import { EVENT } from '@/constants'
import { useCommandStore } from '@/stores'
import { hide } from '@tauri-apps/api/app'
import { useEffect } from 'react'
import useOpen from './useOpen'

export const useCommandInit = () => {
  const { openFolderDialog } = useOpen()

  useEffect(() => {
    useCommandStore.getState().addCommand({ id: EVENT.app_openFolder, handler: openFolderDialog })
  }, [openFolderDialog])

  useEffect(() => {
    useCommandStore.getState().addCommand({ id: EVENT.app_hide, handler: hide })
  }, [])
}
