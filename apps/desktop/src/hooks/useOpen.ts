import { getFileNameFromPath } from '@/helper/filesys'
import { logger } from '@/helper/logger'
import { dialog } from '@/services/dialog'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import {
  OPEN_WORKSPACE_EXPLORER_EVENT,
  switchWorkspaceInCurrentWindow,
} from '@/services/workspace-switch'
import { currentWindow } from '@/services/windows'
import useLayoutStore from '@/stores/useLayoutStore'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import useEditorStore from '@/stores/useEditorStore'
import { useWorkspaceOpenError, clearWorkspaceOpenError } from '@/services/workspace-open-error'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useCallback } from 'react'
import { useTranslation } from '@/i18n'

const getExtFromPath = (path: string) => {
  const fileName = getFileNameFromPath(path) || ''
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex > -1 ? fileName.slice(dotIndex + 1) : ''
}

const openExplorerInWindow = async (windowLabel: string) => {
  if (windowLabel === currentWindow.label) {
    useLayoutStore.getState().openExplorer()
    return
  }

  await currentWindow.emitTo(windowLabel, OPEN_WORKSPACE_EXPLORER_EVENT)
}

const useOpen = () => {
  const { addRecentWorkspaces } = useOpenedCacheStore()
  const { t } = useTranslation()

  const openFolderInNewWindow = useCallback(async (dir: string) => {
    await invoke<boolean>('save_security_bookmark', { path: dir })
    const windowLabel = await invoke<string>('create_new_window', { path: dir })
    await openExplorerInWindow(windowLabel)
    await addRecentWorkspaces({ path: dir })
  }, [addRecentWorkspaces])

  const openFolderInCurrentWindow = useCallback(
    async (dir: string) => {
      const existingWindowLabel = (await invoke('check_window_by_path', {
        path: dir,
      })) as string | null

      if (existingWindowLabel) {
        if (currentWindow.label === existingWindowLabel) {
          await openExplorerInWindow(existingWindowLabel)
          return true
        }

        await invoke('focus_window_by_label', {
          windowLabel: existingWindowLabel,
        })
        await openExplorerInWindow(existingWindowLabel)
        await addRecentWorkspaces({ path: dir }).catch((error) =>
          logger.error('Failed to update recent workspaces:', error),
        )

        logger.info('Focused existing window for path:', existingWindowLabel)
        return true
      }

      const didSwitch = await switchWorkspaceInCurrentWindow(dir)
      if (!didSwitch) return false

      logger.info('Opening folder in current window:', dir)
      return true
    },
    [addRecentWorkspaces],
  )

  const openFolder = useCallback(
    async (dir: string) => {
      try {
        if (!useEditorStore.getState().getRootPath()) {
          if (await openFolderInCurrentWindow(dir)) clearWorkspaceOpenError()
          return
        }
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
          await openFolderInNewWindow(dir)
          return
        }

        if (action === 'currentWindow') {
          await openFolderInCurrentWindow(dir)
        }
      } catch (error) {
        logger.error('Error showing folder open modal:', error)
        useWorkspaceOpenError.setState({ path: dir, error })
      }
    },
    [openFolderInNewWindow, openFolderInCurrentWindow, t],
  )

  const openFolderDialog = useCallback(async (target?: 'new') => {
    const dir = await open({
      directory: true,
      recursive: true,
      fileAccessMode: 'scoped',
    })

    if (typeof dir !== 'string') return

    if (target === 'new') {
      try { await openFolderInNewWindow(dir) }
      catch (error) { useWorkspaceOpenError.setState({ path: dir, error }) }
    } else await openFolder(dir)
  }, [openFolder, openFolderInNewWindow])

  const openFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [
        { name: 'Markdown / HTML / PDF', extensions: ['md', 'markdown', 'html', 'htm', 'pdf'] },
      ],
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
  }, [])

  return {
    openFolderDialog,
    openFolder,
    openFolderInCurrentWindow,
    closeFolder: () => switchWorkspaceInCurrentWindow(),
    openFile,
  }
}

export default useOpen
