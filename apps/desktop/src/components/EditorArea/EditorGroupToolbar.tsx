import { memo } from 'react'
import styled from 'styled-components'
import { PreviewToolbar } from './editorToolBar/PreviewToolbar/PreviewToolbar'
import { SourceCodeToolbar } from './editorToolBar/SourceCodeToolbar/SourceCodeToolbar'
import { WysiwygToolbar } from './editorToolBar/WysiwygToolbar'

interface EditorGroupToolbarProps {
  editorId?: string
}

function EditorGroupToolbar(props: EditorGroupToolbarProps) {
  const { editorId } = props

  if (!editorId) return null

  return (
    <ToolbarHost className='editor-group-toolbar'>
      <WysiwygToolbar editorId={editorId} />
      <SourceCodeToolbar editorId={editorId} />
      <PreviewToolbar editorId={editorId} />
    </ToolbarHost>
  )
}

const ToolbarHost = styled.div`
  flex: 0 0 auto;
  min-width: 0;
`

export default memo(EditorGroupToolbar)
