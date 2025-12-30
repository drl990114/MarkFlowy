import { MODAL_CONFIRM_ID } from '@/components/Modal'
import { readDirectory } from '@/helper/filesys'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'
import { currentWindow } from '@/services/windows'
import { useEditorStore } from '@/stores'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import NiceModal from '@ebay/nice-modal-react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const useOpen = () => {
  const { addRecentWorkspaces } = useOpenedCacheStore()
  const { t } = useTranslation()

  const openFolder = useCallback(
    async (dir: string) => {
      try {
        NiceModal.show(MODAL_CONFIRM_ID, {
          title: t('file.openFolderModal.title'),
          confirmText: t('file.openFolderModal.newWindow'),
          cancelText: t('file.openFolderModal.currentWindow'),
          onConfirm: async () => {
            try {
              await invoke('create_new_window', {
                path: dir,
              })
              addRecentWorkspaces({ path: dir })
            } catch (error) {
              console.error('Error creating new window:', error)
            }
          },
          onClose: async () => {
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

                console.log('Focused existing window for path:', existingWindowLabel)
                return
              }

              const res = await readDirectory(dir)
              addRecentWorkspaces({ path: dir })
              useEditorStore.getState().setFolderData(res)

              console.log('Opening folder in current window:', dir)
            } catch (error) {
              console.error('Error opening folder in current window:', error)
            }
          },
        })
      } catch (error) {
        console.error('Error showing folder open modal:', error)
      }
    },
    [addRecentWorkspaces, t],
  )

  const openFolderDialog = useCallback(async () => {
    const dir = await open({ directory: true, recursive: true })

    if (typeof dir !== 'string') return
    openFolder(dir)
  }, [openFolder])

  const openFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (typeof file !== 'string') return

    const fileContent = await getFileContent({ filePath: file })

    if (fileContent === null) return

    const fileName = file.split('/').pop() || 'new-file.md'

    await addExistingMarkdownFileEdit({
      fileName,
      content: fileContent,
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
