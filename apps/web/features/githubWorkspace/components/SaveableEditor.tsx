import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import { WebEditor, type WebEditorRef } from '../../../components/Editor'

export interface SaveableEditorRef {
  getContent: () => string | undefined
  save: () => void
}

interface SaveableEditorProps {
  fileId?: string
  viewType?: string
  initialContent?: string
  onSave?: (content: string) => void
  onChange?: (content: string) => void
}

export const SaveableEditor = forwardRef<SaveableEditorRef, SaveableEditorProps>(
  function SaveableEditor(props, ref) {
    const { fileId, viewType, initialContent, onSave, onChange } = props
    const editorRef = useRef<WebEditorRef>(null)

    const getContent = useCallback(() => {
      return editorRef.current?.getContent()
    }, [])

    const save = useCallback(() => {
      const content = getContent()
      if (content !== undefined && onSave) {
        onSave(content)
      }
    }, [getContent, onSave])

    useImperativeHandle(
      ref,
      () => ({
        getContent,
        save,
      }),
      [getContent, save],
    )

    return (
      <WebEditor
        ref={editorRef}
        fileId={fileId}
        viewType={viewType}
        initialContent={initialContent}
        onChange={onChange}
      />
    )
  },
)
