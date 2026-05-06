import Markdown from 'markdown-to-jsx'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Editor as RmeEditor, type EditorChangeEventParams, type EditorRef } from 'rme'
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
  }

  p {
    margin-bottom: 1em;
  }

  ul, ol {
    margin-bottom: 1em;
    padding-left: 2em;
  }

  code {
    background: rgba(255, 255, 255, 0.1);
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-family: monospace;
  }

  pre {
    background: rgba(255, 255, 255, 0.05);
    padding: 1em;
    border-radius: 6px;
    overflow-x: auto;

    code {
      background: none;
      padding: 0;
    }
  }

  blockquote {
    border-left: 4px solid #da936a;
    padding-left: 1em;
    margin-left: 0;
    color: ${(props) => props.theme.disabledFontColor};
  }

  img {
    max-width: 100%;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin-bottom: 1em;

    th, td {
      border: 1px solid ${(props) => props.theme.borderColor};
      padding: 0.5em;
    }

    th {
      background: ${(props) => props.theme.bgColorSecondary};
    }
  }
`

const LoadingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 16px;
  color: ${(props) => props.theme.labelFontColor};
`

interface EditorProps {
  fileId: string
  viewType?: string
  initialContent?: string
  onChange?: (content: string) => void
  active?: boolean
}

const Editor = (props: EditorProps) => {
  const { fileId, viewType, initialContent, onChange, active = true } = props
  const { Editor, EditorViewType, createWysiwygDelegate, createSourceCodeDelegate, loading, error } = useRmeEditor()
  const [content, setContent] = useState(initialContent || '')
  const editorRef = useRef<EditorRef>(null)
  
  // Track current view type
  const [currentViewType, setCurrentViewType] = useState(viewType || 'wysiwyg')
  
  // Key to force re-mount when view type changes
  const [editorKey, setEditorKey] = useState(0)
  
  // Track if editor is ready (for CSR)
  const [isReady, setIsReady] = useState(false)
  
  // Create delegate function - same pattern as desktop
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
  
  // Initialize delegate with current view type - same as desktop pattern
  const [delegate, setDelegate] = useState(() => createDelegate(viewType || 'wysiwyg'))

  const defaultContent = initialContent || `##### Welcome to MarkFlowy!`

  // CSR: ensure component is mounted on client
  useEffect(() => {
    setIsReady(true)
  }, [])

  // Handle initialContent changes (file switching)
  useEffect(() => {
    if (initialContent !== undefined && initialContent !== content) {
      setContent(initialContent)
      // Force re-mount editor with new content
      setEditorKey(prev => prev + 1)
    }
  }, [initialContent])

  // Handle view type changes - following desktop pattern
  useEffect(() => {
    if (viewType && viewType !== currentViewType) {
      // Update current view type first
      setCurrentViewType(viewType)
      
      // For wysiwyg and source, create new delegate and force re-mount
      if (viewType === 'wysiwyg' || viewType === 'source') {
        const newDelegate = createDelegate(viewType)
        if (newDelegate) {
          setDelegate(newDelegate)
          // Force re-mount editor with new key when view type changes
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
      
      // Convert doc to string and update content
      if (delegate && typeof delegate.docToString === 'function') {
        try {
          const newContent = delegate.docToString(params.state.doc)
          if (newContent !== undefined) {
            setContent(newContent)
            onChange?.(newContent)
          }
        } catch {
          // Ignore conversion errors
        }
      }
    },
    [delegate, onChange],
  )

  // Memoize editor props like desktop does
  const editorProps = useMemo(() => ({
    initialType: (currentViewType === 'wysiwyg' && EditorViewType ? EditorViewType.WYSIWYG : (EditorViewType?.SOURCE_CODE || 'sourceCode')) as any,
    content: content || defaultContent,
    delegate,
    styleToken: {
      rootFontSize: `14px`,
    },
  }), [currentViewType, EditorViewType, content, defaultContent, delegate])

  if (!isReady || loading) {
    return <LoadingContainer>Loading Editor...</LoadingContainer>
  }

  if (error) {
    return <LoadingContainer>Error loading editor: {error.message}</LoadingContainer>
  }

  // Preview mode - render markdown as HTML
  if (currentViewType === 'preview') {
    return (
      <RmeProvider
        themeTokens={{
          bgColor: '#14120B',
        }}
      >
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
    <RmeProvider
      themeTokens={{
        bgColor: '#14120B',
      }}
    >
      <EditorContainer>
        <RmeEditor
          key={editorKey}
          ref={editorRef}
          {...editorProps}
          delegate={delegate!}
          onChange={handleChange}
        />
      </EditorContainer>
    </RmeProvider>
  )
}

export default memo(Editor)
