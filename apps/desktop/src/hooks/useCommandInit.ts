import { commandRegistry } from '@/commands'
import { EVENT } from '@/constants'
import { hide } from '@tauri-apps/api/app'
import { useEffect } from 'react'
import useOpen from './useOpen'

export const useCommandInit = () => {
  const { openFolderDialog } = useOpen()

  useEffect(() => {
    const disposable1 = commandRegistry.registerCommand({ id: EVENT.app_openFolder, handler: openFolderDialog })
    const disposable2 = commandRegistry.registerCommand({ id: EVENT.app_hide, handler: hide })

    return () => {
      disposable1.dispose()
      disposable2.dispose()
    }
  }, [openFolderDialog])
}
