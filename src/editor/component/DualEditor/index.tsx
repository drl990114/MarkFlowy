import { createContextState } from 'create-context-state'
import React, { memo, useEffect, useMemo, useRef } from 'react'
import type { ReactExtensions, UseRemirrorReturn } from '@remirror/react'
import { Remirror, useRemirror } from '@remirror/react'
import { EditorExtensions } from '@editor'
import { DataCenter } from '@utils'
import type { Editor } from 'codemirror'
import CodeMirror from 'codemirror'
import styled from 'styled-components'
import { emit } from '@tauri-apps/api/event'
import Text from '../Text'
import 'codemirror/lib/codemirror.css'

interface Context extends Props {}

interface Props {
  visual: UseRemirrorReturn<ReactExtensions<ReturnType<typeof EditorExtensions>[number]>>
}

const [DualEditorProvider, useDualEditor] = createContextState<Context, Props>(({ props }) => {
  return {
    ...props,
  }
})

const Container = styled.div`
  .CodeMirror {
    height: 100%;
    width: 100%;
  }
`
// eslint-disable-next-line react/display-name
const MarkdownTextEditor = memo(() => {
  const { visual } = useDualEditor()
  const codemirrorRef = useRef<CodeMirror.EditorFromTextArea>()
  const ctx = useMemo(
    () => ({
      setContent: (content: string) => {
        codemirrorRef.current?.setValue(content)
      },
    }),
    []
  )

  const handleChange = (instance: Editor) => {
    const value = instance.getValue()
    const visualCtx = visual.getContext()
    visualCtx?.setContent(value)
    DataCenter.setRenderEditorCtx([ctx, visualCtx])
    emit('editor_content_change', { content: value })
  }

  useEffect(() => {
    const el = document.getElementById('editTextArea')

    if (!el) return

    if (codemirrorRef.current) {
      codemirrorRef.current.on('change', handleChange)
    } else {
      codemirrorRef.current = CodeMirror.fromTextArea(el as HTMLTextAreaElement, {
        mode: 'gfm', // github-flavored-markdown
        theme: 'default',
        indentUnit: 2,
        tabSize: 2,
        lineWrapping: true,
      })
      codemirrorRef.current.setValue(DataCenter.getData('markdownContent'))
    }
    return () => {
      codemirrorRef.current?.off('change', handleChange)
    }
  }, [handleChange])

  useEffect(() => {
    setTimeout(() => {
      const value = codemirrorRef.current?.getValue() || ''
      visual.getContext()?.setContent(value)
    })
  }, [visual])

  return (
    <Container className="flex-1 border-r-1 px-4">
      <textarea id="editTextArea" />
    </Container>
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

  return (
    <DualEditorProvider visual={visual}>
      <MarkdownTextEditor />
      <VisualEditor />
    </DualEditorProvider>
  )
}
