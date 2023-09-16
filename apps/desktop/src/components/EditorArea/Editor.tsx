/* eslint-disable react-hooks/rules-of-hooks */
import { Editor as MfEditor } from '@linebyline/editor'
import type { EditorContext, EditorRef, EditorViewType } from '@linebyline/editor'
import { invoke } from '@tauri-apps/api'
import { appWindow } from '@tauri-apps/api/window'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { useCommandStore, useEditorStore } from '@/stores'
import { getFileObject } from '@/helper/files'
import { useEditorState } from '@/editorHooks/EditorState'
import useChangeCodeMirrorTheme from '@/editorHooks/useChangeCodeMirrorTheme'
import { createWysiwygDelegate } from '@linebyline/editor'
import { createSourceCodeDelegate } from '@linebyline/editor'
import { useCommandEvent } from '@/editorHooks/CommandEvent'
import { EditorCount } from '@/editorToolBar/EditorCount'
import bus from '@/helper/eventBus'
import { EVENT } from '@/constants'
import classNames from 'classnames'
import { WarningHeader } from './styles'

const EditorWrapper = styled.div<{ active: boolean }>`
  min-height: 100%;
  overflow: hidden;

  ${(props) =>
    props.active
      ? css({
          maxWidth: '800px',
          margin: '0 auto',
          padding: '0 20px',
          paddingBottom: '8rem',
          marginInlineStart: 'auto',
          marginInlineEnd: 'auto',
        })
      : css({
          display: 'none',
        })}
`

function Editor(props: EditorProps) {
  const { id, active } = props
  const curFile = getFileObject(id)
  const [content, setContent] = useState<string>()
  const { setEditorDelegate, getEditorContent, setEditorCtx } = useEditorStore()
  const { execute } = useCommandStore()
  const editorRef = useRef<EditorRef>(null)
  const [delegate, setDelegate] = useState(createWysiwygDelegate())
  const [notExistFile, setNotExistFile] = useState(false)

  useEffect(() => {
    const init = async () => {
      const file = getFileObject(id)
      setEditorDelegate(id, delegate)

      if (file.path) {
        const isExists = await invoke('file_exists', { filePath: file.path })
        if (isExists) {
          const text = await invoke('get_file_content', {
            filePath: file.path,
          })
          setContent(text as string)
        } else {
          setNotExistFile(true)
        }
      } else if (file.content !== undefined) {
        setContent(file.content)
      }
    }
    init()
  }, [id, delegate, setEditorDelegate])

  useEffect(() => {
    const unListen = appWindow.listen<EditorViewType>('editor_toggle_type', async ({ payload }) => {
      if (active) {
        if (editorRef.current?.getType() === payload) {
          return
        }

        bus.emit(EVENT.editor_save, {
          onSuccess: () => {
            const text = getEditorContent(curFile.id)
            setContent(text)

            if (payload === 'sourceCode') {
              const sourceCodeDelegate = createSourceCodeDelegate()
              setEditorDelegate(curFile.id, sourceCodeDelegate)
              setDelegate(sourceCodeDelegate)
            } else {
              const wysiwygDelegate = createWysiwygDelegate()
              setEditorDelegate(curFile.id, wysiwygDelegate)
              setDelegate(wysiwygDelegate)
            }
            editorRef.current?.toggleType(payload)
          },
        })
      }
    })

    return () => {
      unListen.then((fn) => fn())
    }
  }, [active, curFile, execute, getEditorContent, setEditorDelegate])

  const handleWrapperClick: React.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if ((e.target as HTMLElement)?.id === 'editorarea-wrapper') {
        delegate.manager.view.focus()
      }
    },
    [delegate.manager.view],
  )

  const editorProps = useMemo(
    () => ({
      content: content!,
      delegate,
      offset: { top: 30, left: 16 },
      onContextMounted: (context: EditorContext) => {
        setEditorCtx(id, context)
      },
      hooks: [
        () => {
          useEditorState({ active, file: curFile })
          useCommandEvent({ active })
          useChangeCodeMirrorTheme()
        },
      ],
      wysiwygToolBar: [<EditorCount key='editor-count' />],
      markdownToolBar: [<EditorCount key='editor-count' />],
    }),
    [content, delegate, setEditorCtx, id, active, curFile],
  )

  if (notExistFile) {
    return <WarningHeader>File is not exist</WarningHeader>
  }

  const cls = classNames('code-contents', {
    'editor-active': active,
    'display-none': !active,
  })

  return (
    <div className={cls}>
      {typeof content === 'string' ? (
        <EditorWrapper id='editorarea-wrapper' active={active} onClick={handleWrapperClick}>
          <MfEditor ref={editorRef} {...editorProps} />
        </EditorWrapper>
      ) : null}
    </div>
  )
}

export interface EditorProps {
  id: string
  active: boolean
  onSave?: () => void
}

export default memo(Editor)
