import { memo, useRef } from 'react'
import { EditorViewType, Editor as RmeEditor } from 'rme'
import styled from 'styled-components'
import { useRmeEditor } from '../hooks/useRme'
import RmeProvider from './RmeProvider'

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

const Editor = (props: { viewType?: string; initialContent?: string }) => {
  const editorRef = useRef<any>(null)
  const { Editor, createWysiwygDelegate, createSourceCodeDelegate, loading, error } = useRmeEditor()

  const initialContent =
    props.initialContent ||
    `##### Welcome to MarkFlowy!`

  if (loading) {
    return <LoadingContainer>Loading Editor...</LoadingContainer>
  }

  if (error) {
    return <LoadingContainer>Error loading editor: {error.message}</LoadingContainer>
  }

  if (!Editor || !EditorViewType || !createWysiwygDelegate || !createSourceCodeDelegate) {
    return <LoadingContainer>Loading Editor...</LoadingContainer>
  }

  return (
    <RmeProvider
      themeTokens={{
        bgColor: '#14120B',
      }}
    >
      <EditorContainer>
        <RmeEditor
          ref={editorRef}
          content={initialContent}
          styleToken={{
            rootFontSize: `14px`,
          }}
          initialType={
            props.viewType === 'wysiwyg' ? EditorViewType.WYSIWYG : EditorViewType.SOURCECODE
          }
          delegate={
            props.viewType === 'wysiwyg'
              ? createWysiwygDelegate()
              : createSourceCodeDelegate({
                  language: 'json',
                  onCodemirrorViewLoad: () => {},
                })
          }
        />
      </EditorContainer>
    </RmeProvider>
  )
}

export default memo(Editor)
