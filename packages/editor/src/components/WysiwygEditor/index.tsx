import { Remirror } from '@remirror/react'
import { type FC, createContext } from 'react'
import Text from '../Text'
import Wrapper from '../Wrapper'
import { createWysiwygDelegate } from './delegate'
import type { EditorDelegate } from '../../types'
import TableToolbar from '../../toolbar/TableToolbar'
import { ProsemirrorDevTools } from '@remirror/dev'
import React from 'react'
import ErrorBoundary from '../ErrorBoundary'

export const OffsetContext = createContext({ top: 0, left: 0 })

const WysiwygEditor: FC<WysiwygEditorProps> = (props) => {
  const { content, hooks, delegate, offset, wysiwygToolBar, isTesting } = props

  const editorDelegate = delegate ?? createWysiwygDelegate()

  let initialContent
  try {
    initialContent = editorDelegate.stringToDoc(content)
  } catch (error) {
    return <ErrorBoundary hasError error={error}/>
  }

  return (
    <ErrorBoundary>
      <Wrapper>
        <OffsetContext.Provider value={offset || { top: 0, left: 0 }}>
          <Remirror
            manager={editorDelegate.manager}
            initialContent={initialContent}
            hooks={hooks}
          >
            <TableToolbar />
            {wysiwygToolBar || null}
            <Text className='w-full markdown-body' />
            {isTesting ? <ProsemirrorDevTools /> : null}
          </Remirror>
        </OffsetContext.Provider>
      </Wrapper>
    </ErrorBoundary>
  )
}

export default WysiwygEditor
export * from './delegate'

export type EditorChangeHandler = (params: { undoDepth: number }) => void

interface WysiwygEditorProps {
  content: string
  isTesting?: boolean
  offset?: {
    top: number
    left: number
  }
  hooks?: (() => void)[]
  delegate?: EditorDelegate
  wysiwygToolBar?: React.ReactNode[]
}
