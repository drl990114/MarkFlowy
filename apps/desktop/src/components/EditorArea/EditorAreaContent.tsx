import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace'
import { useEditorStore } from '@/stores'
import { memo } from 'react'
import EditorLayoutView from './EditorLayoutView'
import { Container, EditorPanel, OverlayScrollbarStyles } from './styles'

function EditorAreaContent() {
  const { editorLayout } = useEditorStore()

  return (
    <Container className='w-full h-full editor-area-container'>
      <OverlayScrollbarStyles />
      <FindReplace />
      <EditorPanel id='editor-panel'>
        <EditorLayoutView node={editorLayout} />
      </EditorPanel>
    </Container>
  )
}

export default memo(EditorAreaContent)
