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

  .mf-editor-toolbar {
    min-height: 30px;
    padding: 3px 8px;

    .icon,
    [data-slot='button'],
    [data-slot='tooltip-trigger'] {
      border-radius: 5px;
    }

    .icon,
    [data-slot='button'] i,
    [data-slot='tooltip-trigger'] i {
      font-size: 15px;
    }
  }
`

export default memo(EditorGroupToolbar)
