import { getWorkspace, WorkSpace } from '@/services/workspace'
import { useCommandStore } from '@/stores'
import { t } from 'i18next'
import { memo, useCallback, useEffect, useState } from 'react'
import styled from 'styled-components'
import { Dialog } from 'zens'

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

  return (
    <WorkspaceDialogWrapper title={t('workspace.info')} open={open} onClose={handleClose}>
      {workspace ? (
        <WorkspaceMainContainer>
          <div>
            <i className='ri-folder-5-line'></i>:{' '}
            <span style={{ fontSize: '0.9em' }}>{workspace.rootPath}</span>
          </div>
        </WorkspaceMainContainer>
      ) : (
        <div>{t('workspace.none')}</div>
      )}
    </WorkspaceDialogWrapper>
  )
})
