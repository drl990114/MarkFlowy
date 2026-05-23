import RmeProvider from 'components/RmeProvider'
import { useRmeEditor } from 'hooks/useRme'
import Markdown from 'markdown-to-jsx'
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import type { EditorRef } from 'rme'
import styled from 'styled-components'

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

export interface SaveableEditorRef {
  getContent: () => string | undefined
}

interface SaveableEditorProps {
  initialContent?: string
  viewType?: string
}

export const SaveableEditor = forwardRef<SaveableEditorRef, SaveableEditorProps>(
  function SaveableEditor(props, ref) {
    const { Editor, EditorViewType, createWysiwygDelegate, createSourceCodeDelegate, loading, error } =
      useRmeEditor()
    
    const [content, setContent] = useState(props.initialContent || '')
    const editorRef = useRef<EditorRef>(null)
    
    // Track current view type
    const [currentViewType, setCurrentViewType] = useState(props.viewType || 'wysiwyg')
    
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
    const [delegate, setDelegate] = useState(() => createDelegate(props.viewType || 'wysiwyg'))

    const initialContent = props.initialContent || `##### Welcome to MarkFlowy!`

    // CSR: ensure component is mounted on client
    useEffect(() => {
      setIsReady(true)
    }, [])

    // Handle view type changes - following desktop pattern
    useEffect(() => {
      if (props.viewType && props.viewType !== currentViewType) {
        // Update current view type first
        setCurrentViewType(props.viewType)
        
        // For wysiwyg and source, create new delegate and force re-mount
        if (props.viewType === 'wysiwyg' || props.viewType === 'source') {
          const newDelegate = createDelegate(props.viewType)
          if (newDelegate) {
            setDelegate(newDelegate)
            // Force re-mount editor with new key when view type changes
            setEditorKey(prev => prev + 1)
          }
        }
      }
    }, [props.viewType, currentViewType, createDelegate])

    const handleChange = useCallback(
      (params: any) => {
        if (params?.state) {
          // Update content for preview mode
          if (delegate && typeof delegate.docToString === 'function') {
            try {
              const newContent = delegate.docToString?.(params.state.doc)
              if (newContent !== undefined) {
                setContent(newContent)
              }
            } catch {
              // Ignore conversion errors
            }
          }
        }
      },
      [delegate],
    )

    useImperativeHandle(
      ref,
      () => ({
        getContent: () => {
          if (!delegate || !editorRef.current) {
            return undefined
          }
          try {
            // Access editor state through ref
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

    // Memoize editor props like desktop does
    const editorProps = useMemo(() => ({
      initialType: (currentViewType === 'wysiwyg' && EditorViewType
        ? (EditorViewType as any).WYSIWYG 
        : ((EditorViewType as any)?.SOURCE_CODE || 'sourceCode')) as any,
      content: content || initialContent,
      delegate,
      styleToken: {
        rootFontSize: `14px`,
      },
    }), [currentViewType, EditorViewType, content, initialContent, delegate])

    if (!isReady || loading) {
      return <LoadingContainer>Loading Editor...</LoadingContainer>
    }

    if (error) {
      return <LoadingContainer>Error loading editor: {error.message}</LoadingContainer>
    }

    // Preview mode - render markdown as HTML
    if (currentViewType === 'preview') {
      return (
        <RmeProvider>
          <PreviewContainer>
            <Markdown>{content || initialContent}</Markdown>
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
