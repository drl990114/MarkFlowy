import { getFileNameFromPath } from '@/helper/filesys'
import { getWorkspace, WorkSpace } from '@/services/workspace'
import { useCommandStore, useEditorStore } from '@/stores'
import { useEffect, useState } from 'react'
import styled from 'styled-components'

const Container = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 6px;
  max-width: 200px;
  cursor: pointer;
  transition: background-color 0.3s ease-in-out;

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
  }
`

export const WorkspaceBtn = () => {
  const { folderData } = useEditorStore()
  const [workspace, setWorkspace] = useState<WorkSpace | null>(null)

  useEffect(() => {
    getWorkspace().then((workspace) => {
      setWorkspace(workspace)
    })
  }, [folderData])

  return workspace ? (
    <>
      <Container
        onClick={() => {
          useCommandStore.getState().execute('open_workspace_dialog')
        }}
      >
        {getFileNameFromPath(workspace.rootPath || '')}
      </Container>
    </>
  ) : null
}
