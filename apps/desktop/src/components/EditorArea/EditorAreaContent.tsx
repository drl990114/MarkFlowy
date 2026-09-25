import { EditorOpeningClockContext } from './EditorLoadingProgress'
import { markStartupInteractive } from '@/startup/interactive'
import { useEditorStore } from '@/stores'
import useLayoutStore from '@/stores/useLayoutStore'
import { memo, useContext, useLayoutEffect } from 'react'
import EditorLayoutView from './EditorLayoutView'
import { Container, EditorPanel, OverlayScrollbarStyles } from './styles'

function EditorAreaContent() {
  const openingClock = useContext(EditorOpeningClockContext)
  useLayoutEffect(() => {
    if (openingClock) openingClock.startedAt = null
  }, [openingClock])
  const editorLayout = useEditorStore((state) => state.editorLayout)
  const workspacePath = useEditorStore((state) => state.folderData?.[0]?.path)
  const activeGroupId = useEditorStore((state) => state.activeGroupId)
  const activeId = useEditorStore((state) => state.activeId)
  useLayoutEffect(() => {
    if (!activeId) markStartupInteractive('empty')
  }, [activeId])
  const zenModeActive = useLayoutStore((state) => state.zenModeActive)

  return (
    <Container className='w-full h-full editor-area-container'>
      <OverlayScrollbarStyles />
      <EditorPanel id='editor-panel'>
        <EditorLayoutView
          key={workspacePath ?? ''}
          activeGroupId={activeGroupId}
          node={editorLayout}
          zenModeActive={zenModeActive}
        />
      </EditorPanel>
    </Container>
  )
}

export default memo(EditorAreaContent)
