import { Remirror } from '@remirror/react'
import { type FC, createContext } from 'react'
import Text from '../Text'
import Wrapper from '../Wrapper'
import { createWysiwygDelegate } from './delegate'
import type { EditorDelegate } from '../../../types'
import TableToolbar from '../../toolbar/TableToolbar'

export const OffsetContext = createContext({ top: 0, left: 0 })

const WysiwygEditor: FC<WysiwygEditorProps> = (props) => {
  const { content, hooks, delegate, offset, wysiwygToolBar } = props

  const editorDelegate = delegate ?? createWysiwygDelegate()

  return (
    <Wrapper>
      <OffsetContext.Provider value={offset || { top: 0, left: 0 }}>
        <Remirror
          manager={editorDelegate.manager}
          initialContent={editorDelegate.stringToDoc(content)}
          hooks={hooks}
        >
          <TableToolbar />
          {wysiwygToolBar || null}
          <Text className="w-full markdown-body" />
        </Remirror>
      </OffsetContext.Provider>
    </Wrapper>
  )
}

export default WysiwygEditor
export * from './delegate'

export type EditorChangeHandler = (params: { undoDepth: number }) => void

interface WysiwygEditorProps {
  file: Global.IFile
  content: string
  active: boolean
  offset?: {
    top: number
    left: number
  }
  hooks?: (() => void)[]
  delegate?: EditorDelegate
  wysiwygToolBar?: React.ReactNode[]
}
