import { getFileNameFromPath, readDirectory } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { dialog } from '@/services/dialog'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { currentWindow } from '@/services/windows'
import { useEditorStore } from '@/stores'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback } from 'react'
import { useTranslation } from '@/i18n'

const getExtFromPath = (path: string) => {
  const fileName = getFileNameFromPath(path) || ''
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > -1 ? fileName.slice(dotIndex + 1) : ''
}

const useOpen = () => {
  const { addRecentWorkspaces } = useOpenedCacheStore()
  const { t } = useTranslation()

  const openFolder = useCallback(
    async (dir: string) => {
      try {
        const action = await dialog.confirm({
          title: t('file.openFolderModal.title'),
          actions: [
            { id: 'currentWindow', label: t('file.openFolderModal.currentWindow') },
            { id: 'newWindow', label: t('file.openFolderModal.newWindow'), primary: true },
          ],
          remember: {
            key: 'open_folder_target_window',
            label: t('dialog.remember_choice'),
          },
        })

        if (action === 'newWindow') {
          try {
            await invoke('create_new_window', {
              path: dir,
            })
            addRecentWorkspaces({ path: dir })
          } catch (error) {
            logger.error('Error creating new window:', error)
          }
          return
        }

        if (action === 'currentWindow') {
          try {
            const existingWindowLabel = (await invoke('check_window_by_path', {
              path: dir,
            })) as string | null

            if (existingWindowLabel) {
              if (currentWindow.label === existingWindowLabel) {
                return
              }

              await invoke('focus_window_by_label', {
                windowLabel: existingWindowLabel,
              })
              addRecentWorkspaces({ path: dir })

              logger.info('Focused existing window for path:', existingWindowLabel)
              return
            }

            const res = await readDirectory(dir)
            addRecentWorkspaces({ path: dir })
            useEditorStore.getState().setFolderData(res)

            logger.info('Opening folder in current window:', dir)
          } catch (error) {
            logger.error('Error opening folder in current window:', error)
          }
        }
      } catch (error) {
        logger.error('Error showing folder open modal:', error)
      }
    },
    [addRecentWorkspaces, t],
  )

  const openFolderDialog = useCallback(async () => {
    const dir = await open({ 
      directory: true, 
      recursive: true,
      fileAccessMode: 'scoped'
    })

    if (typeof dir !== 'string') return

    await invoke<boolean>('save_security_bookmark', { path: dir })
    await invoke<boolean>('activate_workspace_root', { path: dir })

    openFolder(dir)
  }, [openFolder])

  const openFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
      fileAccessMode: 'scoped',
    })

    if (typeof file !== 'string') return

    await invoke<boolean>('save_security_bookmark', { path: file })

    const fileName = getFileNameFromPath(file) || 'new-file.md'

    await addExistingMarkdownFileEdit({
      fileName,
      ext: getExtFromPath(file),
      path: file,
    })
  }, [addRecentWorkspaces])

  return {
    openFolderDialog,
    openFolder,
    openFile,
  }
}

export default useOpen
