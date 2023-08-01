import type { UseRemirrorReturn } from '@remirror/react'
import { Remirror, useRemirror } from '@remirror/react'
import { createContextState } from 'create-context-state'
import React, { memo, useCallback } from 'react'
import styled from 'styled-components'
import Text from '../Text'
import type { EditorDelegate } from '../../../types'
import {
  BlockquoteExtension,
  BoldExtension,
  BulletListExtension,
  CodeBlockExtension,
  CodeExtension,
  HardBreakExtension,
  HeadingExtension,
  ItalicExtension,
  LinkExtension,
  ListItemExtension,
  MarkdownExtension,
  OrderedListExtension,
  StrikeExtension,
  TrailingNodeExtension,
  TableExtension
} from 'remirror/extensions'
type Context = Props

interface Props {
  file: Global.IFile
  content: string
  active: boolean
  visual: UseRemirrorReturn<any>
  markText: EditorDelegate
  hooks: (() => void)[]
}

const [DualEditorProvider, useDualEditor] = createContextState<Context, Props>(
  ({ props }) => {
    return {
      ...props,
    }
  },
)

const MarkdownTextEditor = memo(
  (props: { markdownToolBar?: React.ReactNode[] }) => {
    const { markdownToolBar } = props
    const { visual, content, markText, hooks } = useDualEditor()

    return (
      <Remirror
        manager={markText.manager}
        initialContent={markText.stringToDoc(content)}
        onChange={({  state }) => {
          const text = markText.docToString(state.doc)
          visual.getContext()?.setContent(text)
        }}
        hooks={hooks}
      >
        <Text
          className="h-full w-full overflow-auto px-0"
          style={{ padding: 0 }}
        />
        {markdownToolBar || null}
      </Remirror>
    )
  },
)

function VisualEditor() {
  const { visual } = useDualEditor()

  return (
    <Remirror manager={visual.manager} editable={false}>
      <Text className="h-full w-full overflow-scroll markdown-body" />
    </Remirror>
  )
}

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
const DualEditor: React.FC<DualEditorProps> = (props) => {
  const { file, content, active, delegate, hooks, markdownToolBar } = props

  const extensions = useCallback(
    () => [
      new LinkExtension({ autoLink: true }),
      new BoldExtension(),
      new StrikeExtension(),
      new ItalicExtension(),
      new HeadingExtension(),
      new BlockquoteExtension(),
      new BulletListExtension({ enableSpine: true }),
      new OrderedListExtension(),
      new ListItemExtension({}),
      new CodeExtension(),
      new CodeBlockExtension(),
      new TrailingNodeExtension(),
      new TableExtension(),
      new MarkdownExtension({ copyAsMarkdown: false }),
      new HardBreakExtension(),
    ],
    [],
  )

  const visual = useRemirror({
    extensions,
    stringHandler: 'markdown',
    selection: 'start',
    content,
  })
  
  return (
    <DualEditorProvider
      content={content}
      file={file}
      markText={delegate}
      visual={visual}
      active={active}
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
  file: Global.IFile
  active: boolean
  content: string
  delegate: EditorDelegate
  hooks: (() => void)[]
  markdownToolBar?: React.ReactNode[]
}
