import { DualEditor, WysiwygEditor } from '@linebyline/editor'
import type { EditorViewType } from '@linebyline/editor/types'
import { invoke } from '@tauri-apps/api'
import { emit } from '@tauri-apps/api/event'
import { appWindow } from '@tauri-apps/api/window'
import { useEffect, useMemo, useState } from 'react'
import styled, { css } from 'styled-components'
import { useEditorStore } from '@/stores'
import { getFileObject } from '@/helper/files'
import { useEditorState } from '@/editorHooks/EditorState'
import { createWysiwygDelegate } from '@linebyline/editor/src/components/WysiwygEditor/delegate'
import { createDualDelegate } from '@linebyline/editor/src/components/DualEditor/delegate'

const EditorWrapper = styled.div<{ active: boolean; type: EditorViewType }>`
  height: 100%;
  overflow: hidden;

  ${(props) =>
    props.active
      ? css({
          display: props.type === 'dual' ? 'flex' : '',
        })
      : css({
          display: 'none',
        })}
`

function Editor(props: EditorProps) {
  const { id, active } = props
  const curFile = getFileObject(id)
  const [type, setType] = useState<EditorViewType>('wysiwyg')
  const [content, setContent] = useState<string>()
  const { setEditorDelegate, getEditorContent } = useEditorStore()
  const [delegate, setDelegate] = useState(createWysiwygDelegate())

  useEffect(() => {
    const init = async () => {
      const file = getFileObject(id)
      setEditorDelegate(id, delegate)

      if (file.path) {
        const text = await invoke('get_file_content', {
          filePath: file.path,
        })
        setContent(text as string)
      } else if (file.content) {
        setContent(file.content)
      }
    }
    init()
  }, [id, delegate, setEditorDelegate])

  useEffect(() => {
    const unListen = appWindow.listen<EditorViewType>('editor_toggle_type', async ({ payload }) => {
      if (active) {
        if (curFile.path) emit('file_save')

        const text = getEditorContent(curFile.id)
        setContent(text)

        if (payload === 'dual') {
          const dualDelegate = createDualDelegate()
          setEditorDelegate(curFile.id, dualDelegate)
          setDelegate(dualDelegate)
        } else {
          const wysiwygDelegate = createWysiwygDelegate()
          setEditorDelegate(curFile.id, wysiwygDelegate)
          setDelegate(wysiwygDelegate)
        }

        setType(payload)
      }
    })

    return () => {
      unListen.then((fn) => fn())
    }
  }, [active, curFile, getEditorContent, setEditorDelegate])

  const editorProps = useMemo(
    () => ({
      file: curFile,
      content: content!,
      active,
      delegate,
      hooks: [
        () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          useEditorState({ active, file: curFile })
        },
      ],
    }),
    [curFile, content, active, delegate],
  )

  return typeof content === 'string' ? (
    <EditorWrapper active={active} type={type}>
      {type === 'dual' ? <DualEditor {...editorProps} /> : <WysiwygEditor {...editorProps} />}
    </EditorWrapper>
  ) : null
}

export interface EditorProps {
  id: string
  active: boolean
  onSave?: () => void
}

export default Editor
