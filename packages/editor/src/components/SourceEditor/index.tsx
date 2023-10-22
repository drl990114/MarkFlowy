import { Remirror } from '@remirror/react'
import { createContextState } from 'create-context-state'
import React, { memo, useCallback, useMemo } from 'react'
import Text from '../Text'
import type { EditorDelegate } from '../../types'
import { ProsemirrorDevTools } from '@remirror/dev'
import { createSourceCodeDelegate } from './delegate'
import ErrorBoundary from '../ErrorBoundary'
import type { EditorProps } from '../Editor'
import type { Extension, RemirrorEventListener } from 'remirror'

type Context = Props

type Props = {
  markText: EditorDelegate
} & Partial<EditorProps>

const [SourceEditorProvider, useSourceCodeEditor] = createContextState<Context, Props>(
  ({ props }) => {
    return {
      ...props,
    }
  },
)

const SourceCodeEditorCore = memo((props: { markdownToolBar?: React.ReactNode[] }) => {
  const { markdownToolBar } = props
  const { content, markText, hooks, isTesting } = useSourceCodeEditor()

  let initialCntent

  try {
    initialCntent = markText.stringToDoc(content!)
  } catch (error) {
    return <ErrorBoundary hasError error={error} />
  }

  return (
    <ErrorBoundary>
      <Remirror manager={markText.manager} initialContent={initialCntent} hooks={hooks}>
        <Text className='h-full w-full overflow-auto px-0' style={{ padding: 0 }} />
        {markdownToolBar || null}
        {isTesting ? <ProsemirrorDevTools /> : null}
      </Remirror>
    </ErrorBoundary>
  )
})

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
const SourceEditor: React.FC<EditorProps> = (props) => {
  const { content, delegate, isTesting, hooks, markdownToolBar } = props

  const editorDelegate = useMemo(() => delegate ?? createSourceCodeDelegate(), [delegate])

  const handleChange: RemirrorEventListener<Extension> = useCallback(
    (params) => {
      try {
        const textContent = editorDelegate.docToString(params.state.doc)
        props.onChange?.(params, textContent)
      } catch (error) {
        console.error(error)
      }
    },
    [editorDelegate, props],
  )

  return (
    <SourceEditorProvider
      content={content}
      isTesting={isTesting}
      markText={editorDelegate}
      onChange={handleChange}
      hooks={hooks}
    >
      <SourceCodeEditorCore markdownToolBar={markdownToolBar} />
    </SourceEditorProvider>
  )
}

export default memo(SourceEditor)

export * from './delegate'
