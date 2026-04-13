import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import styled from 'styled-components'
import { useRmeEditor } from 'hooks/useRme'
import RmeProvider from 'components/RmeProvider'

const EditorContainer = styled.div`
  padding: 1rem;
  width: 100%;
  height: 100%;
  overflow: auto;
  font-weight: 400;
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 16px;
  color: ${(props) => props.theme.labelFontColor};
`

export interface SaveableEditorRef {
  getContent: () => string | undefined
}

interface SaveableEditorProps {
  initialContent?: string
  viewType?: string
}

export const SaveableEditor = forwardRef<SaveableEditorRef, SaveableEditorProps>(
  function SaveableEditor(props, ref) {
    const editorRef = useRef<any>(null)
    const { Editor, EditorViewType, createWysiwygDelegate, createSourceCodeDelegate, loading, error } =
      useRmeEditor()

    const [editorState, setEditorState] = useState<any>(null)

    const delegate =
      props.viewType === 'wysiwyg'
        ? createWysiwygDelegate?.()
        : createSourceCodeDelegate?.({
            language: 'json',
            onCodemirrorViewLoad: () => {},
          })

    const handleChange = useCallback(
      (params: any) => {
        if (params?.state) {
          setEditorState(params.state)
        }
      },
      [setEditorState],
    )

    useImperativeHandle(
      ref,
      () => ({
        getContent: () => {
          if (!delegate || !editorState?.doc) {
            return undefined
          }
          try {
            return delegate.docToString?.(editorState.doc)
          } catch {
            return undefined
          }
        },
      }),
      [delegate, editorState],
    )

    const initialContent = props.initialContent || `##### Welcome to MarkFlowy!`

    if (loading) {
      return <LoadingContainer>Loading Editor...</LoadingContainer>
    }

    if (error) {
      return <LoadingContainer>Error loading editor: {error.message}</LoadingContainer>
    }

    if (!Editor || !EditorViewType || !delegate) {
      return <LoadingContainer>Loading Editor...</LoadingContainer>
    }

    return (
      <RmeProvider
        themeTokens={{
          bgColor: '#14120B',
        }}
      >
        <EditorContainer>
          <Editor
            ref={editorRef}
            content={initialContent}
            styleToken={{
              rootFontSize: `14px`,
            }}
                        initialType={
              props.viewType === 'wysiwyg' ? EditorViewType.WYSIWYG : EditorViewType.SOURCE_CODE
            }
            delegate={delegate}
            onChange={handleChange}
          />
        </EditorContainer>
      </RmeProvider>
    )
  },
)
