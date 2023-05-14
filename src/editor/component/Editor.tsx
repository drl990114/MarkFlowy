import { useEffect, useState } from 'react'
import { appWindow } from '@tauri-apps/api/window'
import { getFileObject } from '@/utils/files'
import { readTextFile } from '@tauri-apps/api/fs'
import styled, { css } from 'styled-components'
import BasicEditor from './BasicEditor'
import { DualEditor } from './DualEditor'
import '../theme/github-light.css'

type EditorViewType = 'wysiwyg' | 'dual'

function Editor(props: EditorProps) {
  const { id, active } = props
  const [type, setType] = useState<EditorViewType>('wysiwyg')
  const [content, setContent] = useState<undefined | string>()

  useEffect(() => {
    const init = async () => {
      const file = getFileObject(id)

      if (file.path) {
        const text = await readTextFile(file.path)
        setContent(text)
      } else if (file.content) {
        setContent(file.content)
      }
    }
    init()
  }, [id])

  useEffect(() => {
    const unListen = appWindow.listen<EditorViewType>('editor_toggle_type', ({ payload }) => {
      if (active) {
        setType(payload)
      }
    })

    return () => {
      unListen.then((fn) => fn())
    }
  }, [active])

  const file = getFileObject(props.id)

  return typeof content === 'string' ? (
    <EditorWrapper active={active} type={type}>
      {type === 'dual' ? <DualEditor file={file} content={content} /> : <BasicEditor file={file} content={content} />}
    </EditorWrapper>
  ) : null
}

const EditorWrapper = styled.div<{ active: boolean; type: EditorViewType }>`
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
}

export default Editor
