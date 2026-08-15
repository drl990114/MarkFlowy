import { commandRegistry } from '@/commands'
import { getFileNameFromPath } from '@/helper/filesys'
import { getWorkspace, type WorkSpace } from '@/services/workspace'
import { useEditorStore } from '@/stores'
import { useEffect, useState } from 'react'
import { StatusBarButton } from './StatusBarButton'

export const WorkspaceBtn = () => {
  const { folderData } = useEditorStore()
  const [workspace, setWorkspace] = useState<WorkSpace | null>(null)

  useEffect(() => {
    getWorkspace().then((currentWorkspace) => {
      setWorkspace(currentWorkspace)
    })
  }, [folderData])

  return workspace ? (
    <StatusBarButton
      aria-label={workspace.rootPath || undefined}
      className='max-w-[200px] truncate'
      onClick={() => {
        commandRegistry.execute('open_workspace_dialog')
      }}
    >
      {getFileNameFromPath(workspace.rootPath || '')}
    </StatusBarButton>
  ) : null
}
