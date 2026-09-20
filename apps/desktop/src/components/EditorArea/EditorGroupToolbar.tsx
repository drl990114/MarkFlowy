import { memo } from 'react'
import styled from 'styled-components'
import { PreviewToolbar } from './editorToolBar/PreviewToolbar/PreviewToolbar'
import { SourceCodeToolbar } from './editorToolBar/SourceCodeToolbar/SourceCodeToolbar'
import { WysiwygToolbar } from './editorToolBar/WysiwygToolbar'
import { Button } from '@/components/ui/button'
import { EditorViewType } from '@/constants/editorViewType'
import bus from '@/helper/eventBus'
import { useTranslation } from '@/i18n'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'

interface EditorGroupToolbarProps {
  editorId?: string
}

function EditorGroupToolbar(props: EditorGroupToolbarProps) {
  const { editorId } = props
  const type = useFileTypeConfigStore((state) => state.fileTypeConfigMap.get(editorId ?? '')?.type)
  const mode = useEditorViewTypeStore((state) => state.editorViewTypeMap.get(editorId ?? ''))
  const { t } = useTranslation()

  if (!editorId) return null
  if (type === 'pdf') return null
  if (type === 'html')
    return (
      <div
        className='editor-group-toolbar flex shrink-0 items-center gap-1 border-b border-border px-2 py-1'
        role='group'
        aria-label={t('document_preview.html_title')}
      >
        {[EditorViewType.PREVIEW, EditorViewType.SOURCECODE].map((value) => (
          <Button
            key={value}
            size='sm'
            variant={mode === value ? 'secondary' : 'ghost'}
            aria-pressed={mode === value}
            onClick={() => bus.emit('editor_toggle_type', undefined, value)}
          >
            {t(value === EditorViewType.PREVIEW ? 'view.preview' : 'view.source_code')}
          </Button>
        ))}
      </div>
    )

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
    min-height: 32px;
    padding: 3px 8px;
  }
`

export default memo(EditorGroupToolbar)
