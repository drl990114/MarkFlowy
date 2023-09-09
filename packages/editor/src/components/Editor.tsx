/* eslint-disable react-hooks/rules-of-hooks */
import WysiwygEditor from './WysiwygEditor'
import SourceEditor from './SourceEditor'
import { forwardRef, memo, useImperativeHandle, useState } from 'react'
import type { EditorDelegate, EditorViewType } from '..'

export type EditorRef = {
  toggleType: (targetType: EditorViewType) => void
  getType: () => EditorViewType
}

export const Editor = memo(forwardRef<EditorRef, EditorProps>((props, ref) => {
  const [type, setType] = useState<EditorViewType>('wysiwyg')

  useImperativeHandle(ref, () => ({
    getType: () => type,
    toggleType: (targetType: EditorViewType) => {
      setType(targetType)
    },
  }))

  return type === 'sourceCode' ? (
      <SourceEditor {...props} />
    ) : (
      <WysiwygEditor {...props} />
    )
}))

export interface EditorProps {
  content: string
  isTesting?: boolean
  delegate: EditorDelegate
  hooks?: (() => void)[]
  markdownToolBar?: React.ReactNode[]
}

