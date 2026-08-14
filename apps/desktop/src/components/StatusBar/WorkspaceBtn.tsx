import { commandRegistry } from '@/commands'
import { getFileNameFromPath } from '@/helper/filesys'
import { getWorkspace, type WorkSpace } from '@/services/workspace'
import { useEditorStore } from '@/stores'
import { useEffect, useState } from 'react'
import styled from 'styled-components'

const Container = styled.button`
  border: 0;
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 0 6px;
  max-width: 200px;
  cursor: pointer;
  color: ${(props) => props.theme.labelFontColor};
  font: inherit;
  background: transparent;
  border-radius: ${(props) => props.theme.smallBorderRadius};
  transition:
    color 100ms ease,
    background-color 100ms ease;

  &:hover {
    color: ${(props) => props.theme.primaryFontColor};
    background-color: ${(props) => props.theme.hoverColor};
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: -2px;
  }
`

export const WorkspaceBtn = () => {
  const { folderData } = useEditorStore()
  const [workspace, setWorkspace] = useState<WorkSpace | null>(null)

  useEffect(() => {
    getWorkspace().then((currentWorkspace) => {
      setWorkspace(currentWorkspace)
    })
  }, [folderData])

  return workspace ? (
    <>
      <Container
        aria-label={workspace.rootPath || undefined}
        onClick={() => {
          commandRegistry.execute('open_workspace_dialog')
        }}
        type='button'
      >
        {getFileNameFromPath(workspace.rootPath || '')}
      </Container>
    </>
  ) : null
}
