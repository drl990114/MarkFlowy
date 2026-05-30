import RmeProvider from 'components/RmeProvider'
import { useRmeEditor } from 'hooks/useRme'
import Markdown from 'markdown-to-jsx'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { EditorChangeEventParams, EditorRef } from 'rme'
import styled from 'styled-components'

const EditorContainer = styled.div`
  padding: 0;
  width: 100%;
  min-width: 0;
  height: 100%;
  overflow: auto;
  font-weight: 400;

  .rme-editor-root {
    padding: 16px 24px;
  }
`

const PreviewContainer = styled.div`
  padding: 1rem;
  width: 100%;
  height: 100%;
  overflow: auto;
  font-weight: 400;
  line-height: 1.6;

  h1, h2, h3, h4, h5, h6 {
    margin-top: 1.5em;
    margin-bottom: 0.5em;
    font-family: var(--sans);
  }

  p {
    margin-bottom: 1em;
  }

  ul, ol {
    margin-bottom: 1em;
    padding-left: 2em;
  }

  code {
    background: var(--paper-warm);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: var(--mono);
    font-size: 0.9em;
  }

  pre {
    background: var(--paper-warm);
    padding: 1em;
    border-radius: 6px;
    overflow-x: auto;

    code {
      background: none;
      padding: 0;
    }
  }

  blockquote {
    border-left: 3px solid var(--seal);
    padding-left: 1em;
    margin-left: 0;
    color: var(--ink-mute);
  }

  img {
    max-width: 100%;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;

    th, td {
      border: 1px solid var(--line);
      padding: 0.5em;
    }

    th {
      background: var(--paper-warm);
    }
  }
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 16px;
  color: var(--ink-faint);
  font-family: var(--body);
`

export interface WebEditorRef {
  getContent: () => string | undefined
}

interface WebEditorProps {
  fileId?: string
  viewType?: string
  initialContent?: string
  onChange?: (content: string) => void
  active?: boolean
}

export const WebEditor = forwardRef<WebEditorRef, WebEditorProps>(
  function WebEditor(props, ref) {
    const { fileId, viewType, initialContent, onChange, active = true } = props
    const { Editor, EditorViewType, createWysiwygDelegate, createSourceCodeDelegate, loading, error } = useRmeEditor()
    const [content, setContent] = useState(initialContent || '')
    const editorRef = useRef<EditorRef>(null)

    const [currentViewType, setCurrentViewType] = useState(viewType || 'wysiwyg')

    const [editorKey, setEditorKey] = useState(0)

    const [isReady, setIsReady] = useState(false)

    const createDelegate = useCallback((viewType: string) => {
      if (!createWysiwygDelegate || !createSourceCodeDelegate) {
        return null
      }
      return viewType === 'wysiwyg'
        ? createWysiwygDelegate()
        : createSourceCodeDelegate({
            language: 'markdown',
            onCodemirrorViewLoad: () => {},
          })
    }, [createWysiwygDelegate, createSourceCodeDelegate])

    const [delegate, setDelegate] = useState(() => createDelegate(viewType || 'wysiwyg'))

    useEffect(() => {
      if (!delegate && createWysiwygDelegate && createSourceCodeDelegate) {
        const newDelegate = createDelegate(currentViewType)
        if (newDelegate) {
          setDelegate(newDelegate)
        }
      }
    }, [delegate, createWysiwygDelegate, createSourceCodeDelegate, currentViewType, createDelegate])

    const defaultContent = initialContent || `##### Welcome to MarkFlowy!`

    useEffect(() => {
      setIsReady(true)
    }, [])

    useEffect(() => {
      if (initialContent !== undefined && initialContent !== content) {
        setContent(initialContent)
        setEditorKey(prev => prev + 1)
      }
    }, [initialContent])

    useEffect(() => {
      if (viewType && viewType !== currentViewType) {
        setCurrentViewType(viewType)

        if (viewType === 'wysiwyg' || viewType === 'source') {
          const newDelegate = createDelegate(viewType)
          if (newDelegate) {
            setDelegate(newDelegate)
            setEditorKey(prev => prev + 1)
          }
        }
      }
    }, [viewType, currentViewType, createDelegate])

    const handleChange = useCallback(
      (params: EditorChangeEventParams) => {
        if (!params || !params.state) {
          return
        }

        if (delegate && typeof delegate.docToString === 'function') {
          try {
            const newContent = delegate.docToString(params.state.doc)
            if (newContent !== undefined) {
              setContent(newContent)
              onChange?.(newContent)
            }
          } catch {
          }
        }
      },
      [delegate, onChange],
    )

    useImperativeHandle(
      ref,
      () => ({
        getContent: () => {
          if (!delegate || !editorRef.current) {
            return undefined
          }
          try {
            const editor = editorRef.current as any
            if (editor.state?.doc && typeof delegate.docToString === 'function') {
              return delegate.docToString(editor.state.doc)
            }
            return undefined
          } catch {
            return undefined
          }
        },
      }),
      [delegate],
    )

    const editorProps = useMemo(() => ({
      initialType: (currentViewType === 'wysiwyg' && EditorViewType ? EditorViewType.WYSIWYG : (EditorViewType?.SOURCE_CODE || 'sourceCode')) as any,
      content: content || defaultContent,
      delegate,
    }), [currentViewType, EditorViewType, content, defaultContent, delegate])

    if (!isReady || loading) {
      return <LoadingContainer>Loading Editor...</LoadingContainer>
    }

    if (error) {
      return <LoadingContainer>Error loading editor: {error.message}</LoadingContainer>
    }

    if (currentViewType === 'preview') {
      return (
        <RmeProvider>
          <PreviewContainer>
            <Markdown>{content || defaultContent}</Markdown>
          </PreviewContainer>
        </RmeProvider>
      )
    }

    if (!Editor || !EditorViewType || !delegate) {
      return <LoadingContainer>Loading Editor...</LoadingContainer>
    }

    return (
      <RmeProvider>
        <EditorContainer>
          <Editor
            key={editorKey}
            ref={editorRef}
            {...editorProps}
            delegate={delegate!}
            onChange={handleChange}
          />
        </EditorContainer>
      </RmeProvider>
    )
  },
)

export default WebEditor

export type { SaveableEditorRef } from '../features/githubWorkspace/components/SaveableEditor'
export { SaveableEditor } from '../features/githubWorkspace/components/SaveableEditor'
