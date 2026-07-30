import RmeProvider from 'components/RmeProvider'
import { useRmeEditor } from 'hooks/useRme'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
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

const PreviewScroller = styled.div`
  width: 100%;
  height: 100%;
  overflow: auto;
`

const PreviewWidth = styled.div`
  width: 100%;
  max-width: 800px;
  min-height: 100%;
  margin: 0 auto;
  padding-bottom: 3rem;
  box-sizing: border-box;
  --rme-editor-inline-padding: clamp(16px, 5vw, 40px);
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
  editable?: boolean
}

export const WebEditor = forwardRef<WebEditorRef, WebEditorProps>(function WebEditor(props, ref) {
  const { viewType, initialContent, onChange, editable = true } = props
  const {
    Editor,
    EditorViewType,
    createWysiwygDelegate,
    createSourceCodeDelegate,
    loading,
    error,
  } = useRmeEditor()
  const [content, setContent] = useState(
    initialContent === undefined ? '##### Welcome to MarkFlowy!' : initialContent,
  )
  const latestContentRef = useRef(content)
  const isApplyingExternalContentRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const editorRef = useRef<EditorRef>(null)
  onChangeRef.current = onChange

  const [currentViewType, setCurrentViewType] = useState(viewType || 'wysiwyg')

  const [editorKey, setEditorKey] = useState(0)

  const [isReady, setIsReady] = useState(false)

  const createDelegate = useCallback(
    (nextViewType: string) => {
      if (!createWysiwygDelegate || !createSourceCodeDelegate) {
        return null
      }
      return nextViewType === 'wysiwyg'
        ? createWysiwygDelegate()
        : createSourceCodeDelegate({
            language: 'markdown',
            onCodemirrorViewLoad: () => {},
          })
    },
    [createWysiwygDelegate, createSourceCodeDelegate],
  )

  const [delegate, setDelegate] = useState(() => createDelegate(viewType || 'wysiwyg'))

  useEffect(() => {
    if (!delegate && createWysiwygDelegate && createSourceCodeDelegate) {
      const newDelegate = createDelegate(currentViewType)
      if (newDelegate) {
        setDelegate(newDelegate)
      }
    }
  }, [delegate, createWysiwygDelegate, createSourceCodeDelegate, currentViewType, createDelegate])

  useEffect(() => {
    setIsReady(true)
  }, [])

  useEffect(() => {
    if (initialContent === undefined || initialContent === latestContentRef.current) {
      return
    }

    latestContentRef.current = initialContent
    setContent(initialContent)

    if (editorRef.current) {
      isApplyingExternalContentRef.current = true
      try {
        editorRef.current.setContent(initialContent)
      } finally {
        isApplyingExternalContentRef.current = false
      }
    }
  }, [initialContent])

  useEffect(() => {
    if (viewType && viewType !== currentViewType) {
      setCurrentViewType(viewType)

      if (viewType === 'wysiwyg' || viewType === 'source') {
        const newDelegate = createDelegate(viewType)
        if (newDelegate) {
          setDelegate(newDelegate)
          setEditorKey((prev) => prev + 1)
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
            const isExternalContent = isApplyingExternalContentRef.current
            latestContentRef.current = newContent
            setContent(newContent)
            if (!isExternalContent) {
              onChangeRef.current?.(newContent)
            }
          }
        } catch {}
      }
    },
    [delegate],
  )

  useImperativeHandle(
    ref,
    () => ({
      getContent: () => latestContentRef.current,
    }),
    [],
  )

  const editorProps = useMemo(
    () => ({
      initialType:
        currentViewType === 'wysiwyg' && EditorViewType
          ? EditorViewType.WYSIWYG
          : EditorViewType?.SOURCE_CODE || 'sourceCode',
      content,
      delegate,
    }),
    [currentViewType, EditorViewType, content, delegate],
  )

  if (!isReady || loading) {
    return <LoadingContainer>Loading Editor...</LoadingContainer>
  }

  if (error) {
    return <LoadingContainer>Error loading editor: {error.message}</LoadingContainer>
  }

  if (!Editor || !EditorViewType || !delegate) {
    return <LoadingContainer>Loading Editor...</LoadingContainer>
  }

  if (currentViewType === 'preview') {
    return (
      <RmeProvider>
        <PreviewScroller>
          <PreviewWidth>
            <Editor
              key={`preview-${editorKey}`}
              ref={editorRef}
              {...editorProps}
              initialType='preview'
              delegate={delegate}
              editable={false}
            />
          </PreviewWidth>
        </PreviewScroller>
      </RmeProvider>
    )
  }

  return (
    <RmeProvider>
      <EditorContainer>
        <Editor
          key={editorKey}
          ref={editorRef}
          {...editorProps}
          delegate={delegate!}
          editable={editable}
          onChange={handleChange}
        />
      </EditorContainer>
    </RmeProvider>
  )
})

export default WebEditor

export type { SaveableEditorRef } from '../features/githubWorkspace/components/SaveableEditor'
export { SaveableEditor } from '../features/githubWorkspace/components/SaveableEditor'
