/* eslint-disable react-hooks/rules-of-hooks */
import WysiwygEditor from './WysiwygEditor'
import SourceEditor from './SourceEditor'
import { forwardRef, memo, useImperativeHandle, useMemo, useState } from 'react'
import type { EditorContext, EditorDelegate, EditorViewType } from '..'
import { useContextMounted } from './useContextMounted'
import type { Extension, RemirrorEventListenerProps } from 'remirror'

export type EditorRef = {
  toggleType: (targetType: EditorViewType) => void
  getType: () => EditorViewType
}

export const Editor = memo(
  forwardRef<EditorRef, EditorProps>((props, ref) => {
    const { hooks = [], onContextMounted, ...otherProps } = props
    const [type, setType] = useState<EditorViewType>('wysiwyg')

    useImperativeHandle(ref, () => ({
      getType: () => type,
      toggleType: (targetType: EditorViewType) => {
        setType(targetType)
      },
    }))

    const editorHooks = useMemo(() => {
      return [() => useContextMounted(onContextMounted), ...hooks]
    }, [hooks, onContextMounted])

    return type === 'sourceCode' ? (
      <SourceEditor {...otherProps} hooks={editorHooks} />
    ) : (
      <WysiwygEditor {...otherProps} hooks={editorHooks} />
    )
  }),
)

export type EditorChangeHandler = (
  params: RemirrorEventListenerProps<Extension>,
  content: string,
) => void

export interface EditorProps {
  delegate?: EditorDelegate
  content: string
  isTesting?: boolean
  editable?: boolean
  offset?: {
    top: number
    left: number
  }
  onChange?: EditorChangeHandler
  hooks?: (() => void)[]
  markdownToolBar?: React.ReactNode[]
  wysiwygToolBar?: React.ReactNode[]
  onContextMounted?: (context: EditorContext) => void
}
