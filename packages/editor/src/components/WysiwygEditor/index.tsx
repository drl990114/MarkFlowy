import { Remirror } from '@remirror/react'
import type { FC } from 'react'
import Text from '../Text'
import Wrapper from '../Wrapper'
import { createWysiwygDelegate } from './delegate'
import type { EditorDelegate } from '../../../types'

const WysiwygEditor: FC<WysiwygEditorProps> = (props) => {
  const { content, hooks, delegate } = props

  const editorDelegate = delegate ?? createWysiwygDelegate()

  return (
    <Wrapper className="remirror-wrapper">
      <Remirror manager={editorDelegate.manager} initialContent={editorDelegate.stringToDoc(content)} hooks={hooks}>
        <Text className="h-full w-full overflow-auto markdown-body" />
      </Remirror>
    </Wrapper>
  )
}

export default WysiwygEditor

export type EditorChangeHandler = (params: { undoDepth: number }) => void

interface WysiwygEditorProps {
  file: Global.IFile
  content: string
  active: boolean
  hooks?: (() => void)[]
  delegate?: EditorDelegate
}
