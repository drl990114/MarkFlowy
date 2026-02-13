import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace'
import { SourceCodeToolbar } from '@/components/EditorArea/editorToolBar/SourceCodeToolbar/SourceCodeToolbar'
import { WysiwygToolbar } from '@/components/EditorArea/editorToolBar/WysiwygToolbar'
import { useEditorStore } from '@/stores'
import { memo } from 'react'
import Editor from './Editor'
import EditorAreaTabs from './EditorAreaTabs'
import { EditorCount } from './editorToolBar/EditorCount'
import { EmptyState } from './EmptyState'
import { Container } from './styles'

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
      <FindReplace />
      {opened.map((id) => {
        return <Editor key={id} id={id} active={id === activeId} />
      })}
      <EditorCount />
    </Container>
  )
}

export default memo(EditorArea)
