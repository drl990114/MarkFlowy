import type { UseRemirrorReturn } from '@remirror/react'
import { Remirror, useRemirror } from '@remirror/react'
import { createContextState } from 'create-context-state'
import React, { memo } from 'react'
import styled from 'styled-components'
import Text from '../Text'
import type { EditorDelegate } from '../../types'
import { ProsemirrorDevTools } from "@remirror/dev"
import { DualVisualExtensions } from '../../extensions'
import { createDualDelegate } from './delegate'

type Context = Props

type Props = {
  visual: UseRemirrorReturn<any>
  markText: EditorDelegate
} & Partial<DualEditorProps>

const [DualEditorProvider, useDualEditor] = createContextState<Context, Props>(({ props }) => {
  return {
    ...props,
  }
})

const MarkdownTextEditor = memo((props: { markdownToolBar?: React.ReactNode[] }) => {
  const { markdownToolBar } = props
  const { visual, content, markText, hooks, isTesting } = useDualEditor()

  return (
    <Remirror
      manager={markText.manager}
      initialContent={markText.stringToDoc(content!)}
      onChange={({ state }) => {
        const text = markText.docToString(state.doc)
        visual.getContext()?.setContent(text)
      }}
      hooks={hooks}
    >
      <Text className='h-full w-full overflow-auto px-0' style={{ padding: 0 }} />
      {markdownToolBar || null}
      {isTesting ? <ProsemirrorDevTools /> : null}
    </Remirror>
  )
})

function VisualEditor() {
  const { visual } = useDualEditor()

  return (
    <Remirror manager={visual.manager} editable={false}>
      <Text className='h-full w-full overflow-scroll markdown-body' />
    </Remirror>
  )
}

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
const DualEditor: React.FC<DualEditorProps> = (props) => {
  const { content, delegate, isTesting, hooks, markdownToolBar } = props

  const visual = useRemirror({
    extensions: DualVisualExtensions,
    stringHandler: 'markdown',
    selection: 'start',
  })

  return (
    <DualEditorProvider
      content={content}
      isTesting={isTesting}
      markText={delegate || createDualDelegate()}
      visual={visual}
      hooks={hooks}
    >
      <MarkdownTextEditor markdownToolBar={markdownToolBar} />
      <Devider />
      <VisualEditor />
    </DualEditorProvider>
  )
}

export default DualEditor

export * from './delegate'

const Devider = styled.div`
  height: 100%;
  background-color: #eaecef;
  width: 1px;
`
interface DualEditorProps {
  content: string
  isTesting?: boolean
  delegate: EditorDelegate
  hooks: (() => void)[]
  markdownToolBar?: React.ReactNode[]
}
