import { createContextState } from 'create-context-state'
import React, { useEffect, useMemo, useState } from 'react'
import type { CodeBlockExtension, DocExtension } from 'remirror/extensions'
import { HardBreakExtension, MarkdownExtension } from 'remirror/extensions'
import type { ReactExtensions, UseRemirrorReturn } from '@remirror/react'
import { Remirror, useRemirror } from '@remirror/react'
import { EditorExtensions } from '@editor'
import { DataCenter } from '@utils'
import { emit } from '@tauri-apps/api/event'
import Text from '../Text'

interface Context extends Props {
  setMarkdown: (content: string) => void
  setVisual: (markdown: string) => void
}

interface Props {
  visual: UseRemirrorReturn<ReactExtensions<ReturnType<typeof EditorExtensions>[number]>>
  markdown: UseRemirrorReturn<ReactExtensions<DocExtension | CodeBlockExtension>>
}

const [DualEditorProvider, useDualEditor] = createContextState<Context, Props>(({ props }) => {
  return {
    ...props,
    setMarkdown: (content: string) => {
      const ctx = props.markdown.getContext()
      DataCenter.setRenderEditorCtx(ctx, 0)
      return ctx?.setContent(content)
    },
  }
})

function MarkdownTextEditor() {
  const { visual } = useDualEditor()
  const [value, setValue] = useState(DataCenter.getData('markdownContent'))

  const ctx = useMemo(() => {
    return {
      setContent: (content: string) => {
        setValue(content)
      },
    }
  }, [])

  useEffect(() => {
    setTimeout(() => {
      console.log('effect', visual.getContext()?.setContent(value))
    })
  }, [value, visual])

  return (
    <textarea
      className="flex-1 border-r-1 px-4"
      value={value}
      onChange={(e) => {
        const visualCtx = visual.getContext()
        visualCtx?.setContent(value)
        DataCenter.setRenderEditorCtx([ctx, visualCtx])
        emit('editor_content_change', { content: e.target.value })
        setValue(e.target.value)
      }}
    />
  )
}

function VisualEditor() {
  const { visual, setMarkdown } = useDualEditor()

  return (
    <Remirror
      manager={visual.manager}
      editable={false}
      onChange={({ helpers, state }) => {
        return setMarkdown(helpers.getMarkdown(state))
      }}
    >
      <Text className="h-full w-full overflow-scroll markdown-body" />
    </Remirror>
  )
}

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
export const DualEditor: React.FC = () => {
  const visual = useRemirror({
    extensions: EditorExtensions,
    stringHandler: 'markdown',
    selection: 'start',
    content: '**Markdown** content is the _best_',
  })
  const markdown = useRemirror({
    extensions: () => [new HardBreakExtension(), new MarkdownExtension()],
    content: '**Markdown** content is the _best_',
    builtin: {
      exitMarksOnArrowPress: false,
    },
    stringHandler: 'html',
  })

  return (
    <DualEditorProvider visual={visual} markdown={markdown}>
      <MarkdownTextEditor />
      <VisualEditor />
    </DualEditorProvider>
  )
}
