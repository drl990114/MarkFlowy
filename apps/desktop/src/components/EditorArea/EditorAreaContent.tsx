import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace'
import { useEditorStore } from '@/stores'
import useLayoutStore from '@/stores/useLayoutStore'
import { memo } from 'react'
import EditorLayoutView from './EditorLayoutView'
import { getTopEditorGroupId } from './editorLayoutActionGroups'
import { Container, EditorPanel, OverlayScrollbarStyles } from './styles'

function EditorAreaContent() {
  const editorLayout = useEditorStore((state) => state.editorLayout)
  const activeGroupId = useEditorStore((state) => state.activeGroupId)
  const zenModeActive = useLayoutStore((state) => state.zenModeActive)
  const leftSidebarGroupId = getTopEditorGroupId(editorLayout, 'left')
  const rightSidebarGroupId = getTopEditorGroupId(editorLayout, 'right')

  return (
    <Container className='w-full h-full editor-area-container'>
      <OverlayScrollbarStyles />
      <FindReplace />
      <EditorPanel id='editor-panel'>
        <EditorLayoutView
          activeGroupId={activeGroupId}
          leftSidebarGroupId={leftSidebarGroupId}
          node={editorLayout}
          rightSidebarGroupId={rightSidebarGroupId}
          zenModeActive={zenModeActive}
        />
      </EditorPanel>
    </Container>
  )
}

export default memo(EditorAreaContent)
