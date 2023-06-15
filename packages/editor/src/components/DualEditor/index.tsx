import { languages } from '@codemirror/language-data'
import { oneDark } from '@codemirror/theme-one-dark'
import { CodeMirrorExtension } from '@remirror/extension-codemirror6'
import type { UseRemirrorReturn } from '@remirror/react'
import { Remirror, useRemirror } from '@remirror/react'
import { createContextState } from 'create-context-state'
import React, { memo, useEffect } from 'react'
import styled from 'styled-components'
import EditorExtensions from '../../extensions'
import Text from '../Text'
 
interface Context extends Props {}

interface Props {
  file: Global.IFile
  content: string
  active: boolean
  visual: UseRemirrorReturn<any>
  markText: UseRemirrorReturn<any>
}

const [DualEditorProvider, useDualEditor] = createContextState<Context, Props>(({ props }) => {
  return {
    ...props,
  }
})

// eslint-disable-next-line react/display-name
const MarkdownTextEditor = memo((props: { setEditorCtx: (id: string, ctx: any) => void }) => {
  const { setEditorCtx } = props
  const { visual, file, markText, active } = useDualEditor()

  useEffect(() => {
    setEditorCtx(file.id, { ...markText.getContext(), getContent: () => markText.manager?.view?.state?.doc.textContent })
  }, [markText.getContext])

  return (
    <Remirror
      manager={markText.manager}
      initialContent={markText.state}
      onChange={({ helpers, state }) => {
        const text = helpers.getText({ state })
        visual.getContext()?.setContent(text)
        return markText.getContext()?.setContent({
          type: 'doc',
          content: [
            {
              type: 'codeMirror',
              attrs: {
                language: 'markdown',
              },
              content: text ? [{ type: 'text', text }] : undefined,
            },
          ],
        })
      }}
    >
      <Text className="h-full w-full overflow-auto px-0" style={{ padding: 0 }} />
    </Remirror>
  )
})

function VisualEditor() {
  const { visual } = useDualEditor()

  return (
    <Remirror manager={visual.manager} editable={false}>
      <Text className="h-full w-full overflow-scroll markdown-body" />
    </Remirror>
  )
}

const markTextExtensions = () => {
  return [
    new CodeMirrorExtension({
      languages,
      extensions: [oneDark],
    }),
  ]
}

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
const DualEditor: React.FC<DualEditorProps> = (props) => {
  const { file, content, active, setEditorCtx } = props

  const markText = useRemirror({
    extensions: markTextExtensions as any,
    content: {
      type: 'doc',
      content: [
        {
          type: 'codeMirror',
          attrs: {
            language: 'markdown',
          },
          content: [
            {
              type: 'text',
              text: content,
            },
          ],
        },
      ],
    },
  })

  const visual = useRemirror({
    extensions: EditorExtensions as any,
    stringHandler: 'markdown',
    selection: 'start',
    content: '**Markdown** content is the _best_',
  })

  return (
    <DualEditorProvider content={content} file={file} markText={markText} visual={visual} active={active}>
      <MarkdownTextEditor setEditorCtx={setEditorCtx}/>
      <Devider />
      <VisualEditor />
    </DualEditorProvider>
  )
}

export default DualEditor

const Devider = styled.div`
  height: 100%;
  background-color: #eaecef;
  width: 1px;
`
interface DualEditorProps {
  file: Global.IFile
  active: boolean
  content: string
  setEditorCtx: (id: string, ctx: any) => void
}
