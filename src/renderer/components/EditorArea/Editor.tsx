import { BasicEditor, DualEditor } from '@/editor'
import { EditorViewType } from '@/editor/types'
import { getFileObject } from '@/helper/files'
import { useEditorStore } from '@/renderer/stores'
import { invoke } from '@tauri-apps/api'
import { emit } from '@tauri-apps/api/event'
import { appWindow } from '@tauri-apps/api/window'
import { useEffect, useMemo, useState } from 'react'
import styled, { css } from 'styled-components'

function Editor(props: EditorProps) {
  const { id, active } = props
  const curFile = getFileObject(id)
  const [type, setType] = useState<EditorViewType>('wysiwyg')
  const [content, setContent] = useState<string>()
  const { getEditorContent } = useEditorStore()

  useEffect(() => {
    const init = async () => {
      const file = getFileObject(id)
      if (file.path) {
        const text = (await invoke('get_file_content', {
          filePath: file.path,
        })) as string
        setContent(text)
      } else if (file.content) {
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
          if (curFile.path) {
            emit('file_save')
          }
          const content = getEditorContent(curFile.id)
          setContent(content)
          setType(payload)
        }
      }
    )

    return () => {
      unListen.then((fn) => fn())
    }
  }, [active, curFile])

  const editorProps = useMemo(
    () => ({ file: curFile, content: content!, active }),
    [curFile, content, active]
  )

  return typeof content === 'string' ? (
    <EditorWrapper active={active} type={type}>
      {type === 'dual' ? (
        <DualEditor {...editorProps} />
      ) : (
        <BasicEditor {...editorProps} />
      )}
    </EditorWrapper>
  ) : null
}

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
export interface EditorProps {
  id: string
  active: boolean
  onSave?: () => void
}

export default Editor
