import type { Extension, RemirrorEventListener } from '@rme-sdk/core'
import { ProsemirrorDevTools } from '@rme-sdk/dev'
import { Remirror } from '@rme-sdk/react'
import { memo, useCallback, useEffect, useMemo, type FC } from 'react'
import { TransformerExtension } from '../../extensions/Transformer/transformer-extension'
import { WysiwygThemeWrapper } from '../../theme'
import { BlockHandler } from '../../toolbar/BlockHandler'
import { SlashMenu } from '../../toolbar/SlashMenu'
import TableToolbar from '../../toolbar/TableToolbar'
import { WysiwygToolbar } from '../../toolbar/toolbar'
import { defaultStyleToken, type EditorProps } from '../Editor'
import ErrorBoundary from '../ErrorBoundary'
import Text from './Text'
import { createWysiwygDelegate } from './delegate'

const WysiwygEditor: FC<EditorProps> = (props) => {
  const {
    content,
    hooks,
    delegate,
    wysiwygToolBar,
    isTesting,
    editable = true,
    wysiwygToolBarOptions,
    styleToken = defaultStyleToken,
    wysiwygTextContainerProps = {},
  } = props

  const editorDelegate = useMemo(() => delegate ?? createWysiwygDelegate(), [delegate])

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

  useEffect(() => {
    const ext = editorDelegate.manager.getExtension(TransformerExtension)

    if (ext) {
      editorDelegate?.manager?.view?.dispatch(
        editorDelegate.manager.view.state.tr.setMeta(ext.pluginKey, {
          stringToDoc: editorDelegate.stringToDoc,
          docToString: editorDelegate.docToString,
        }),
      )
    }
  }, [editorDelegate])

  let initialContent
  try {
    initialContent = editorDelegate.stringToDoc(content)
  } catch (error) {
    return <ErrorBoundary hasError error={error} {...(props.errorHandler || {})} />
  }

  return (
    <ErrorBoundary {...(props.errorHandler || {})}>
      <WysiwygThemeWrapper {...styleToken}>
        <Remirror
          manager={editorDelegate.manager}
          initialContent={initialContent}
          hooks={hooks}
          editable={editable}
          onChange={handleChange}
          autoRender={false}
        >
          {wysiwygToolBarOptions?.enable ? (
            <WysiwygToolbar {...wysiwygToolBarOptions?.compProps} />
          ) : null}
          <Text {...wysiwygTextContainerProps} />
          <TableToolbar />
          <BlockHandler />
          <SlashMenu />
          {wysiwygToolBar || null}
          {isTesting ? <ProsemirrorDevTools /> : null}
        </Remirror>
      </WysiwygThemeWrapper>
    </ErrorBoundary>
  )
}

export default memo(WysiwygEditor)
export * from './delegate'
