import { EditorOpeningClockContext } from './EditorLoadingProgress'
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
  const activeGroupId = useEditorStore((state) => state.activeGroupId)
  const zenModeActive = useLayoutStore((state) => state.zenModeActive)

  return (
    <Container className='w-full h-full editor-area-container'>
      <OverlayScrollbarStyles />
      <EditorPanel id='editor-panel'>
        <EditorLayoutView
          activeGroupId={activeGroupId}
          node={editorLayout}
          zenModeActive={zenModeActive}
        />
      </EditorPanel>
    </Container>
  )
}

export default memo(EditorAreaContent)
