import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace'
import { PreviewToolbar } from '@/components/EditorArea/editorToolBar/PreviewToolbar/PreviewToolbar'
import { SourceCodeToolbar } from '@/components/EditorArea/editorToolBar/SourceCodeToolbar/SourceCodeToolbar'
import { WysiwygToolbar } from '@/components/EditorArea/editorToolBar/WysiwygToolbar'
import { useEditorStore } from '@/stores'
import { memo } from 'react'
import Editor from './Editor'
import EditorAreaTabs from './EditorAreaTabs'
import { Container, EditorPanel, OverlayScrollbarStyles } from './styles'

function EditorAreaContent() {
  const { opened, activeId } = useEditorStore()

  return (
    <Container className='w-full h-full'>
      <OverlayScrollbarStyles />
      <EditorAreaTabs />
      <WysiwygToolbar />
      <SourceCodeToolbar />
      <PreviewToolbar />
      <FindReplace />
      <EditorPanel id="editor-panel">
        {opened.map((id) => {
          return <Editor key={id} id={id} active={id === activeId} />
        })}
      </EditorPanel>
    </Container>
  )
}

export default memo(EditorAreaContent)
