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

const EditorWrapper = styled.div<{ active: boolean; type: EditorViewType }>`
  height: 100%;
  overflow: hidden;

  ${props =>
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
  const { getEditorContent, setEditorCtx } = useEditorStore()

  useEffect(() => {
    const init = async () => {
      const file = getFileObject(id)
      if (file.path) {
        const text = (await invoke('get_file_content', {
          filePath: file.path,
        }))
        setContent(text as string)
      }
      else if (file.content) {
        setContent(file.content)
      }
    }
    init()
  }, [id])

  useEffect(() => {
    const unListen = appWindow.listen<EditorViewType>(
      'editor_toggle_type',
      async ({ payload }) => {
        if (active) {
          if (curFile.path)
            emit('file_save')

          const text = getEditorContent(curFile.id)
          setContent(text)
          setType(payload)
        }
      },
    )

    return () => {
      unListen.then(fn => fn())
    }
  }, [active, curFile, getEditorContent])

  const editorProps = useMemo(
    () => ({
      file: curFile,
      content: content!,
      active,
      setEditorCtx,
      hooks: [
        () => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          useEditorState({ active, file: curFile })
        },
      ],
    }),
    [curFile, content, active, setEditorCtx],
  )

  return typeof content === 'string'
    ? (
    <EditorWrapper active={active} type={type}>
      {type === 'dual'
        ? (
        <DualEditor {...editorProps} />
          )
        : (
        <WysiwygEditor {...editorProps} />
          )}
    </EditorWrapper>
      )
    : null
}

export interface EditorProps {
  id: string
  active: boolean
  onSave?: () => void
}

export default Editor
