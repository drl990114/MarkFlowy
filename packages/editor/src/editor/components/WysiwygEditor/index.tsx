import type { Extension, RemirrorEventListener } from '@rme-sdk/sdk/core'
import { Remirror } from '@rme-sdk/sdk/react'
import { memo, useCallback, useEffect, useMemo, type FC } from 'react'
import { TransformerExtension } from '../../extensions/Transformer/transformer-extension'
import { WysiwygThemeWrapper } from '../../theme'
import { BlockHandler } from '../../toolbar/BlockHandler'
import { LinkHoverIcon } from '../../toolbar/LinkHoverIcon'
import { SlashMenu } from '../../toolbar/SlashMenu'
import TableToolbar from '../../toolbar/TableToolbar'
import { WysiwygToolbar } from '../../toolbar/toolbar'
import { defaultStyleToken, type EditorProps } from '../Editor'
import { EditorDevTools } from '../EditorDevTools'
import ErrorBoundary from '../ErrorBoundary'
import { useInitialEditorContent } from '../useInitialEditorContent'
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
    blockHandlerOptions,
    styleToken = defaultStyleToken,
    wysiwygTextContainerProps = {},
    onChange,
  } = props

  const editorDelegate = useMemo(() => delegate ?? createWysiwygDelegate(), [delegate])

  const handleChange: RemirrorEventListener<Extension> = useCallback(
    (params) => {
      try {
        // const textContent = editorDelegate.docToString(params.state.doc)
        onChange?.(params)
      } catch (error) {
        console.error(error)
      }
    },
    [onChange],
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

  const initialContent = useInitialEditorContent(editorDelegate, content)
  if (!initialContent.ok) {
    return <ErrorBoundary hasError error={initialContent.error} {...(props.errorHandler || {})} />
  }

  return (
    <ErrorBoundary {...(props.errorHandler || {})}>
      <WysiwygThemeWrapper {...styleToken}>
        <Remirror
          manager={editorDelegate.manager}
          initialContent={initialContent.doc}
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
          <BlockHandler {...blockHandlerOptions} />
          <SlashMenu />
          <LinkHoverIcon handleLinkClick={props.delegateOptions?.handleLinkClick} />
          {wysiwygToolBar || null}
          {isTesting ? <EditorDevTools /> : null}
        </Remirror>
      </WysiwygThemeWrapper>
    </ErrorBoundary>
  )
}

export default memo(WysiwygEditor)
export * from './delegate'
