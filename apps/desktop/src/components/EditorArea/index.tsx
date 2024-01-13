import Editor from './Editor'
import { Container } from './styles'
import { useEditorStore } from '@/stores'
import { memo } from 'react'
import EditorAreaTabs from './EditorAreaTabs'
import { FindReplace } from '@/components/EditorArea/editorToolBar/FindReplace'

function EditorArea() {
  const { opened, activeId } = useEditorStore()

  return (
    <Container className='w-full h-full'>
      <EditorAreaTabs />
      <FindReplace />
        {opened.map((id) => {
          return <Editor key={id} id={id} active={id === activeId} />
        })}
    </Container>
  )
}

export default memo(EditorArea)
