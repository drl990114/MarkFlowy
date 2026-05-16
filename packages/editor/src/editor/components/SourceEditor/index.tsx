import { ProsemirrorDevTools } from '@rme-sdk/dev'
import type { Extension, RemirrorEventListener } from '@rme-sdk/main'
import { Remirror } from '@rme-sdk/react'
import React, { memo, useCallback, useMemo } from 'react'
import { createContextState } from '../../hooks/create-context-state'
import { SourceCodeThemeWrapper } from '../../theme'
import type { EditorDelegate } from '../../types'
import { defaultStyleToken, type EditorProps } from '../Editor'
import ErrorBoundary from '../ErrorBoundary'
import Text from './Text'
import { createSourceCodeDelegate } from './delegate'

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

const SourceCodeEditorCore = memo(
  (props: {
    styleToken?: EditorProps['styleToken']
    textContainerProps?: EditorProps['sourceCodeTextContainerProps']
    markdownToolBar?: React.ReactNode[]
    onChange: RemirrorEventListener<Extension>
    errorHandler?: EditorProps['errorHandler']
  }) => {
    const { markdownToolBar, styleToken, textContainerProps = {} } = props
    const { content, markText, hooks, isTesting, editable } = useSourceCodeEditor()

    let initialCntent

    try {
      initialCntent = markText.stringToDoc(content!)
    } catch (error) {
      return <ErrorBoundary hasError error={error} {...(props.errorHandler || {})} />
    }

    return (
      <ErrorBoundary {...(props.errorHandler || {})}>
        <SourceCodeThemeWrapper {...styleToken}>
          <Remirror
            manager={markText.manager}
            initialContent={initialCntent}
            hooks={hooks}
            editable={editable}
            onChange={props.onChange}
            autoRender={false}
          >
            <Text {...textContainerProps} />
            {markdownToolBar || null}
            {isTesting ? <ProsemirrorDevTools /> : null}
          </Remirror>
        </SourceCodeThemeWrapper>
      </ErrorBoundary>
    )
  },
)

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
const SourceEditor: React.FC<EditorProps> = (props) => {
  const {
    content,
    delegate,
    isTesting,
    hooks,
    markdownToolBar,
    styleToken = defaultStyleToken,
    sourceCodeTextContainerProps = {}
  } = props

  const editorDelegate = useMemo(() => delegate ?? createSourceCodeDelegate(), [delegate])

  const handleChange: RemirrorEventListener<Extension> = useCallback(
    (params) => {
      try {
        // const textContent = editorDelegate.docToString(params.state.doc)
        props.onChange?.(params)
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
      hooks={hooks}
    >
      <SourceCodeEditorCore
        styleToken={styleToken}
        textContainerProps={sourceCodeTextContainerProps}
        markdownToolBar={markdownToolBar}
        onChange={handleChange}
        errorHandler={props.errorHandler}
      />
    </SourceEditorProvider>
  )
}

export default memo(SourceEditor)

export * from './delegate'
