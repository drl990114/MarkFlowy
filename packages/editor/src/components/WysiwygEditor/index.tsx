import { Remirror } from '@remirror/react'
import type { FC } from 'react'
import Text from '../Text'
import Wrapper from '../Wrapper'
import { createWysiwygDelegate } from './delegate'

const WysiwygEditor: FC<WysiwygEditorProps> = (props) => {
  const { content, hooks } = props
  const { manager, stringToDoc } = createWysiwygDelegate()

  return (
    <Wrapper className="remirror-wrapper">
      <Remirror manager={manager} initialContent={stringToDoc(content)} hooks={hooks}>
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
  setEditorCtx: (id: string, ctx: any) => void
}
