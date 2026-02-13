import { getFileObject } from '@/helper/files'
import { getRelativePathWithCurWorkspace } from '@/helper/filesys'
import { gitAddFileWithCurrentWorkspace } from '@/services/git'
import { currentWindow } from '@/services/windows'
import { checkIsGitRepoBySyncMode, getWorkspace } from '@/services/workspace'
import { useEditorStore } from '@/stores'
import { Command } from '@tauri-apps/plugin-shell'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { MfIconButton } from '../../../../ui-v2/Button'
import { showContextMenu } from '../../../../ui-v2/ContextMenu'

export const GitStatus = memo(() => {
  const { activeId, folderData, getRootPath } = useEditorStore()
  const [workspace, setWorkspace] = useState<any>(null)
  const [hasGitStatus, setHasGitStatus] = useState(false)
  const ref = useRef<any>(null)
  const rootPath = getRootPath()
  const curFile = activeId ? getFileObject(activeId) : undefined

  useEffect(() => {
    getWorkspace().then((workspace) => {
      setWorkspace(workspace)
    })
  }, [folderData])

  const checkCurFileGitStatus = useCallback(async () => {
    if (!curFile?.path || !rootPath) {
      setHasGitStatus(false)
      return
    }

    try {
      const res = await Command.create(
        'run-git-diff',
        ['diff', '--name-only', getRelativePathWithCurWorkspace(curFile?.path)],
        {
          cwd: rootPath,
        },
      ).execute()

      if (res.stdout.trim()) {
        setHasGitStatus(true)
      } else {
        setHasGitStatus(false)
      }
    } catch (error) {
      console.error('Failed to check git status:', error)
      setHasGitStatus(false)
    }
  }, [curFile?.path, rootPath])

  useEffect(() => {
    checkCurFileGitStatus()

    const unsubscribe = currentWindow.listen<{
      paths: string[]
    }>('file_watcher_event', async () => {
      if (checkIsGitRepoBySyncMode(workspace?.syncMode)) {
        checkCurFileGitStatus()
      }
    })

    return () => {
      unsubscribe.then((f) => f())
    }
  }, [workspace?.syncMode, checkCurFileGitStatus])

  if (!checkIsGitRepoBySyncMode(workspace?.syncMode) || !hasGitStatus || !curFile) {
    return null
  }

  return (
    <MfIconButton
      size='small'
      rounded='smooth'
      iconRef={ref}
      icon='ri-git-repository-commits-line'
      onClick={() => {
        if (!curFile.path) return

        const rect = ref.current?.getBoundingClientRect()
        if (rect === undefined) return

        showContextMenu({
          x: rect.x,
          y: rect.y + rect.height,
          items: [
            {
              label: 'git add',
              value: 'git_add',
              handler: () => gitAddFileWithCurrentWorkspace(curFile),
            },
          ],
        })
      }}
    />
  )
})
