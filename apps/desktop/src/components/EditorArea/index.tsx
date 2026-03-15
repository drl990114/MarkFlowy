import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace'
import { PreviewToolbar } from '@/components/EditorArea/editorToolBar/PreviewToolbar/PreviewToolbar'
import { SourceCodeToolbar } from '@/components/EditorArea/editorToolBar/SourceCodeToolbar/SourceCodeToolbar'
import { WysiwygToolbar } from '@/components/EditorArea/editorToolBar/WysiwygToolbar'
import { useEditorStore } from '@/stores'
import { memo } from 'react'
import { TocView } from '../TableOfContent'
import Editor from './Editor'
import EditorAreaTabs from './EditorAreaTabs'
import { EditorToc } from './EditorWrapper'
import { EmptyState } from './EmptyState'
import { Container, EditorPanel } from './styles'

function EditorArea() {
  const { opened, activeId } = useEditorStore()

  if (opened.length === 0) {
    return <EmptyState />
  }

  return (
    <Container className='w-full h-full'>
      <EditorAreaTabs />
      <WysiwygToolbar />
      <SourceCodeToolbar />
      <PreviewToolbar />
      <FindReplace />
      <EditorPanel id="editor-panel">
        {opened.map((id) => {
          return <Editor key={id} id={id} active={id === activeId} />
        })}

        <EditorToc >
          <TocView variant='editor' />
        </EditorToc>
      </EditorPanel>
    </Container>
  )
}

export default memo(EditorArea)
