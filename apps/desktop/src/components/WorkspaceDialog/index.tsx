import { gitCommitWithCurrentWorkspace, gitPushWithCurrentWorkspace } from '@/services/git'
import { getWorkspace, WorkSpace, WorkspaceSyncMode } from '@/services/workspace'
import { useCommandStore } from '@/stores'
import { t } from 'i18next'
import { memo, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import { Button, Dialog, Input, toast } from 'zens'

const WorkspaceDialogWrapper = styled(Dialog)`
  max-width: 800px;
  min-width: 500px;
  max-height: 700px;
  overflow: hidden;
  background-color: ${(props) => props.theme.bgColor};
  transition: all 0.3s ease-in-out;

  .dialog-content {
    height: calc(100% - 60px);
    overflow-y: auto;
    padding: 0 24px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background-color: ${(props) => props.theme.borderColor};
      border-radius: 3px;
    }
  }
`

const WorkspaceMainContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 6px 0;
`

export const WorkspaceDialog = memo(() => {
  const [open, setOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkSpace | null>(null)
  const [commitMessage, setCommitMessage] = useState('Daily commit')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    useCommandStore.getState().addCommand({
      id: 'open_workspace_dialog',
      handler: () => {
        setOpen(true)
        getWorkspace().then((workspace) => {
          setWorkspace(workspace)
        })
      },
    })
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  const handleSync = async () => {
    setLoading(true)
    const id = toast.loading('Git commit & push...')
    try {
      await gitCommitWithCurrentWorkspace(commitMessage)
      await gitPushWithCurrentWorkspace()
    } catch (error) {
      toast.error('Failed to sync workspace:' + error)
    } finally {
      setLoading(false)
      toast.dismiss(id)
    }
  }

  return (
    <WorkspaceDialogWrapper
      title={t('workspace.info')}
      open={open}
      onClose={handleClose}
      footer={
        workspace?.syncMode === WorkspaceSyncMode.GIT_LOCAL
          ? [
              <Input
                key='commitMessageInput'
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />,
              <Button key='gitCommit' btnType='primary' onClick={handleSync} disabled={loading}>
                {'git commit & git push'}
              </Button>,
            ]
          : null
      }
    >
      {workspace ? (
        <WorkspaceMainContainer>
          <div>
            <i className='ri-folder-5-line'></i>:{' '}
            <span style={{ fontSize: '0.9em' }}>{workspace.rootPath}</span>
          </div>
          <div>
            <i className='ri-folder-upload-line'></i>:{' '}
            <span style={{ fontSize: '0.9em' }}>
              {workspace.syncModeName}（{workspace.syncModeDescription}）
            </span>
          </div>
        </WorkspaceMainContainer>
      ) : (
        <div>{t('workspace.none')}</div>
      )}
    </WorkspaceDialogWrapper>
  )
})
