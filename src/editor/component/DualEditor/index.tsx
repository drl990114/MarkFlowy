import { createContextState } from 'create-context-state'
import React, { memo, useEffect, useMemo, useRef } from 'react'
import type { ReactExtensions, UseRemirrorReturn } from '@remirror/react'
import { Remirror, useRemirror } from '@remirror/react'
import { EditorExtensions } from '@editor'
import type { Editor } from 'codemirror'
import CodeMirror from 'codemirror'
import styled from 'styled-components'
import Text from '../Text'
import 'codemirror/lib/codemirror.css'
import { useEditorStore } from '@/stores'
import { IFile } from '@/utils/filesys'

interface Context extends Props {}

interface Props {
  file: IFile
  content: string
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
const MarkdownTextEditor = memo((props) => {
  const { visual, file, content } = useDualEditor()
  const { setEditorCtx } = useEditorStore()
  const codemirrorRef = useRef<CodeMirror.EditorFromTextArea>()

  const setContent =  (content: string) => {
    const visualCtx = visual.getContext()
    visualCtx?.setContent(content)
    codemirrorRef.current?.setValue(content)
  }

  const ctx = useMemo(
    () => ({
      setContent,
      helpers: {
        setContent,
        getMarkdown: () => {
          return codemirrorRef.current?.getValue() || ''
        }
      },
    }),
    []
  )

  const handleChange = (instance: Editor) => {
    const value = instance.getValue()
    const visualCtx = visual.getContext()
    visualCtx?.setContent(value)
    setEditorCtx(file.id, ctx)
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
      <textarea id="editTextArea" defaultValue={content} />
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
export const DualEditor: React.FC<DualEditorProps> = (props) => {
  const { file, content } = props
  const visual = useRemirror({
    extensions: EditorExtensions,
    stringHandler: 'markdown',
    selection: 'start',
    content: '**Markdown** content is the _best_',
  })

  return (
    <DualEditorProvider content={content} file={file} visual={visual}>
      <MarkdownTextEditor />
      <VisualEditor />
    </DualEditorProvider>
  )
}

interface DualEditorProps {
  file: IFile
  content: string
}
