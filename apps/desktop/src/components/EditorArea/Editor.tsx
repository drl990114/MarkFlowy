/* eslint-disable react-hooks/rules-of-hooks */
import { Editor as MfEditor, EditorProps as MfEditorProps } from 'rme'
import type {
  EditorChangeEventParams,
  EditorChangeHandler,
  EditorContext,
  EditorRef,
  EditorViewType,
  MfCodemirrorView,
} from 'rme'
import { invoke } from '@tauri-apps/api/core'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { useCommandStore, useEditorStateStore, useEditorStore } from '@/stores'
import { getFileObject, updateFileObject } from '@/helper/files'
import { createWysiwygDelegate } from 'rme'
import { createSourceCodeDelegate } from 'rme'
import { useCommandEvent } from '@/components/EditorArea/editorHooks/CommandEvent'
import bus from '@/helper/eventBus'
import { EVENT } from '@/constants'
import classNames from 'classnames'
import { WarningHeader } from './styles'
import { getFileNameFromPath, getFolderPathFromPath } from '@/helper/filesys'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { save } from '@tauri-apps/plugin-dialog'
import { useTranslation } from 'react-i18next'
import { debounce } from 'lodash'
import { createWysiwygDelegateOptions } from './createWysiwygDelegateOptions'
import { useMount, useUnmount } from 'react-use'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import { toast } from 'zens'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'

interface EditorWrapperProps {
  active: boolean
  fullWidth: boolean
}

type SaveHandlerParams = {
  /**
   * when active is true, saveHandler will save the file content to disk.
   * when active is false, saveHandler will save when editor is active.
   */
  active?: boolean
  onSuccess?: () => void
}

const EditorWrapper = styled.div.attrs<EditorWrapperProps>((props) => props)`
  min-height: 100%;
  overflow: hidden;

  ${(props) =>
    props.active
      ? css({
          maxWidth: props.fullWidth ? 'auto' : '800px',
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

export const sourceCodeCodemirrorViewMap: Map<string, MfCodemirrorView> = new Map()

function Editor(props: EditorProps) {
  const { id, active } = props
  const curFile = getFileObject(id)
  const [notExistFile, setNotExistFile] = useState(false)
  const { setEditorDelegate, setEditorCtx, getEditorContent, insertNodeToFolderData } =
    useEditorStore()
  const { addEditorCounter, deleteEditorCounter } = useEditorCounterStore()
  const { execute } = useCommandStore()
  const { t } = useTranslation()
  const { settingData } = useAppSettingStore()
  const [content, setContent] = useState<string>()
  const [delegate, setDelegate] = useState(
    createWysiwygDelegate(createWysiwygDelegateOptions(getFolderPathFromPath(curFile.path))),
  )
  const editorRef = useRef<EditorRef>(null)
  const editorContextRef = useRef<EditorChangeEventParams>()

  useMount(() => {
    setEditorDelegate(id, delegate)
    useEditorViewTypeStore.getState().setEditorViewType(curFile.id, 'wysiwyg')
  })

  useUnmount(() => {
    deleteEditorCounter({ id })
  })

  useLayoutEffect(() => {
    const init = async () => {
      const file = curFile

      if (file.path) {
        const isExists = await invoke('file_exists', { filePath: file.path })
        if (isExists) {
          const text = await invoke<string>('get_file_content', {
            filePath: file.path,
          })
          setContent(text)
        } else {
          setNotExistFile(true)
          return ''
        }
      } else if (file.content !== undefined) {
        setContent(file.content)
      }

      return ''
    }
    init()
  }, [delegate, curFile, setEditorDelegate])

  useEffect(() => {
    const cb = async (payload: EditorViewType) => {
      if (active) {
        if (editorRef.current?.getType() === payload) {
          return
        }

        bus.emit(EVENT.editor_save, {
          onSuccess: () => {
            if (payload === 'sourceCode') {
              const sourceCodeDelegate = createSourceCodeDelegate({
                onCodemirrorViewLoad: (cmView) => {
                  sourceCodeCodemirrorViewMap.set(curFile.id, cmView)
                  setTimeout(() => {
                    execute('app:toc_refresh')
                  })
                },
              })
              setEditorDelegate(curFile.id, sourceCodeDelegate)
              setDelegate(sourceCodeDelegate)
            } else if (payload === 'preview') {
              const content = getEditorContent(curFile.id)
              setContent(content)
            } else {
              const wysiwygDelegate = createWysiwygDelegate(
                createWysiwygDelegateOptions(getFolderPathFromPath(curFile.path)),
              )
              setEditorDelegate(curFile.id, wysiwygDelegate)
              setDelegate(wysiwygDelegate)
            }
            useEditorViewTypeStore.getState().setEditorViewType(curFile.id, payload)
            editorRef.current?.toggleType(payload)
          },
        })
      }
    }

    bus.on('editor_toggle_type', cb)

    return () => {
      bus.detach('editor_toggle_type', cb)
    }
  }, [active, curFile, execute, setEditorDelegate, getEditorContent])

  const saveHandler = useCallback(
    async (params: SaveHandlerParams = {}) => {
      const { onSuccess } = params
      if (!active && !params.active) return

      if (!curFile) return

      const { idStateMap, setIdStateMap } = useEditorStateStore.getState()

      const curEditorState = idStateMap.get(curFile.id)

      if (!curEditorState?.hasUnsavedChanges) {
        onSuccess?.()
        return
      }

      if (!editorContextRef.current?.state.doc && !curFile.content) {
        // Unexpected
        return
      }

      const fileContent = editorContextRef.current?.state.doc
        ? delegate.docToString(editorContextRef.current.state.doc)
        : curFile.content

      console.log('editorContent', fileContent)

      try {
        if (!curFile.path) {
          save({
            title: 'Save File',
            defaultPath: curFile.name ?? `${t('file.untitled')}.md`,
          })
            .then((path) => {
              if (path === null) return
              const filename = getFileNameFromPath(path)
              updateFileObject(curFile.id, { ...curFile, path, name: filename })
              insertNodeToFolderData({
                ...curFile,
                name: filename,
                content: fileContent,
                path,
              })
              invoke('write_file', { filePath: path, content: fileContent }).then(() => {
                onSuccess?.()
              })
              setIdStateMap(curFile.id, {
                hasUnsavedChanges: false,
              })
            })
            .catch((error) => {
              toast.error(String(error))
            })
        } else {
          invoke('write_file', { filePath: curFile.path, content: fileContent }).then(() => {
            setContent(fileContent)
            onSuccess?.()
          })

          setIdStateMap(curFile.id, {
            hasUnsavedChanges: false,
          })
        }
      } catch (error) {
        toast.error(String(error))
      }
    },
    [active, curFile, delegate, t, insertNodeToFolderData],
  )

  const debounceSave = useMemo(
    () => debounce(() => saveHandler({ active: true }), settingData.autosave_interval),
    [settingData.autosave_interval, saveHandler],
  )
  const debounceRefreshToc = useMemo(
    () => debounce(() => execute('app:toc_refresh'), 1000),
    [execute],
  )

  const debounceSaveHandler = useCallback(debounceSave, [settingData, debounceSave])

  useEffect(() => {
    if (active) {
      debounceRefreshToc()
    }
  }, [active, debounceRefreshToc])

  useEffect(() => {
    if (active) {
      const { addCommand } = useCommandStore.getState()
      addCommand({
        id: 'editor:save',
        handler: () => {
          saveHandler()
        },
      })
    }
  }, [active, saveHandler])

  useEffect(() => {
    const callback = (hooks: SaveHandlerParams) => {
      saveHandler({ onSuccess: hooks?.onSuccess })
    }

    bus.on(EVENT.editor_save, callback)

    return () => {
      bus.detach(EVENT.editor_save, callback)
    }
  }, [saveHandler])

  const handleWrapperClick: React.MouseEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if ((e.target as HTMLElement)?.id === 'editorarea-wrapper') {
        delegate.manager.view.focus()
      }
    },
    [delegate.manager.view],
  )

  const editorProps: MfEditorProps = useMemo(
    () => ({
      content: content!,
      delegate,
      offset: { top: 10, left: 16 },
      styleToken: {
        rootFontSize: `${settingData.editor_root_font_size}px`,
        rootLineHeight: settingData.editor_root_line_height,
      },
      onContextMounted: (context: EditorContext) => {
        setEditorCtx(id, context)
      },
      delegateOptions: createWysiwygDelegateOptions(getFolderPathFromPath(curFile.path)),
      hooks: [
        () => {
          useCommandEvent({ active })
        },
      ],
    }),
    [content, delegate, setEditorCtx, id, active, settingData],
  )

  const handleChange: EditorChangeHandler = useCallback(
    (params) => {
      const { tr, helpers } = params
      const { getCharacterCount, getWordCount } = helpers

      const characterCount = getCharacterCount()
      const wordCount = getWordCount()

      addEditorCounter({
        id,
        data: {
          characterCount,
          wordCount,
        },
      })

      if (!active) return
      editorContextRef.current = params

      if (tr?.docChanged && !tr.getMeta('APPLY_MARKS')) {
        const state = {
          hasUnsavedChanges: true,
          undoDepth: helpers.undoDepth(),
        }
        const { setIdStateMap } = useEditorStateStore.getState()

        setIdStateMap(id, state)
        debounceRefreshToc()
        if (settingData.autosave) {
          debounceSaveHandler()
        }
      }
    },
    [id, debounceSaveHandler, active, debounceRefreshToc, settingData, addEditorCounter],
  )

  if (notExistFile) {
    return <WarningHeader>File is not exist</WarningHeader>
  }

  const cls = classNames('code-contents scrollbar', {
    'editor-active': active,
    'display-none': !active,
  })

  return (
    <div className={cls}>
      {typeof content === 'string' ? (
        <EditorWrapper
          id='editorarea-wrapper'
          className='markdown-body'
          fullWidth={settingData.editor_full_width}
          active={active}
          onClick={handleWrapperClick}
        >
          <MfEditor ref={editorRef} onChange={handleChange} {...editorProps} />
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
