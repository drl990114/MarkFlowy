import { EVENT } from '@/constants'
import { clipboardRead } from '@/helper/clipboard'
import bus from '@/helper/eventBus'
import {
  delSaveOpenedEditorEntries,
  getFileObject,
  setSaveOpenedEditorEntries,
  updateFileObject,
} from '@/helper/files'
import {
  canvasDataToBinary,
  FileResultCode,
  FileSysResult,
  getFileNameFromPath,
} from '@/helper/filesys'
import { FileTypeConfig } from '@/helper/fileTypeHandler'
import { useEditorKeybindingStore } from '@/hooks/useKeyboard'
import { useCommandStore, useEditorStateStore, useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorCounterStore from '@/stores/useEditorCounterStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import * as Sentry from '@sentry/react'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import classNames from 'classnames'
import html2canvas from 'html2canvas'
import { debounce, DebouncedFunc } from 'lodash'
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMount, useUnmount } from 'react-use'
import {
  createSourceCodeDelegate,
  createWysiwygDelegate,
  EditorChangeEventParams,
  EditorChangeHandler,
  EditorContext,
  EditorRef,
  EditorViewType,
  MfCodemirrorView,
  Editor as MfEditor,
  EditorProps as MfEditorProps,
} from 'rme'
import { toast } from 'zens'
import { createWysiwygDelegateOptions } from './createWysiwygDelegateOptions'
import { EditorWrapper } from './EditorWrapper'
import { WarningHeader } from './styles'

type SaveHandlerParams = {
  /**
   * when active is true, saveHandler will save the file content to disk.
   * when active is false, saveHandler will save when editor is active.
   */
  active?: boolean
  onSuccess?: () => void
}

enum TextEditorStatus {
  LOADING,
  SUCCESS,
  NOTEXIST,
}

export const sourceCodeCodemirrorViewMap: Map<string, MfCodemirrorView> = new Map()

function TextEditor(props: TextEditorProps) {
  const { id, active, fileTypeConfig } = props
  const curFile = getFileObject(id)
  const createDelegate = useCallback(
    (editorViewType = EditorViewType.WYSIWYG, sourceCodeLanguage?: string) => {
      if (editorViewType === 'sourceCode') {
        return createSourceCodeDelegate({
          language: sourceCodeLanguage,
          disableAllBuildInShortcuts: true,
          overrideShortcutMap: useEditorKeybindingStore.getState().editorKeybingMap,
          clipboardReadFunction: clipboardRead,
          onCodemirrorViewLoad: (cmView) => {
            sourceCodeCodemirrorViewMap.set(id, cmView)
          },
        })
      } else {
        return createWysiwygDelegate(createWysiwygDelegateOptions(id))
      }
    },
    [id],
  )
  const [status, setStatus] = useState(TextEditorStatus.LOADING)

  const { setEditorDelegate, setEditorCtx, getEditorContent, insertNodeToFolderData } =
    useEditorStore()
  const { execute } = useCommandStore()
  const { t } = useTranslation()
  const { settingData } = useAppSettingStore()
  const [content, setContent] = useState<string>()
  const [delegate, setDelegate] = useState(
    createDelegate(fileTypeConfig.defaultMode, fileTypeConfig.type),
  )

  const debounceSaveHandlerCacheRef = useRef<DebouncedFunc<() => Promise<void>>>(null)
  const noFileSaveingRef = useRef(false)
  const editorRef = useRef<EditorRef>(null)
  const editorContextRef = useRef<EditorChangeEventParams>(null)

  useMount(async () => {
    setEditorDelegate(id, delegate)
  })

  useUnmount(() => {
    useEditorCounterStore.getState().deleteEditorCounter({ id })
    const { delIdStateMap } = useEditorStateStore.getState()

    delIdStateMap(id)
  })

  useLayoutEffect(() => {
    const init = async () => {
      const file = curFile
      if (file.path) {
        const isExists = await invoke('file_exists', { filePath: file.path })
        if (isExists) {
          const res = await invoke<FileSysResult>('get_file_content', {
            filePath: file.path,
          })
          if (res.code !== FileResultCode.Success) {
            toast.error(res.content)
            return
          }
          setContent(res.content)
        } else {
          return setStatus(TextEditorStatus.NOTEXIST)
        }
      } else if (file.content !== undefined) {
        setContent(file.content)
      }

      return setStatus(TextEditorStatus.SUCCESS)
    }
    init()
  }, [delegate, curFile, setEditorDelegate])

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
          if (noFileSaveingRef.current === true) {
            return
          }

          noFileSaveingRef.current = true
          save({
            title: 'Save File',
            defaultPath: curFile.name ?? `${t('file.untitled')}.md`,
          })
            .then((path) => {
              noFileSaveingRef.current = false

              if (path === null) return
              const filename = getFileNameFromPath(path)
              updateFileObject(curFile.id, { ...curFile, path, name: filename })
              insertNodeToFolderData({
                ...curFile,
                name: filename,
                content: fileContent,
                path,
              })
              invoke<FileSysResult>('write_file', { filePath: path, content: fileContent }).then(
                (res) => {
                  if (res.code !== FileResultCode.Success) {
                    return toast.error(res.content)
                  }
                  onSuccess?.()
                },
              )
              setIdStateMap(curFile.id, {
                hasUnsavedChanges: false,
              })
            })
            .catch((error) => {
              noFileSaveingRef.current = false
              toast.error(String(error))
            })
        } else {
          invoke<FileSysResult>('write_file', {
            filePath: curFile.path,
            content: fileContent,
          }).then((res) => {
            if (res.code !== FileResultCode.Success) {
              return toast.error(res.content)
            }
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

  const debounceSave = useMemo(() => {
    return debounce(() => saveHandler({ active: true }), settingData.autosave_interval)
  }, [settingData.autosave_interval, saveHandler])

  const debounceRefreshToc = useMemo(
    () => debounce(() => execute('app:toc_refresh'), 1000),
    [execute],
  )

  const debounceSaveHandler = useCallback(() => {
    if (debounceSave) {
      debounceSaveHandlerCacheRef.current?.cancel()

      debounceSaveHandlerCacheRef.current = debounceSave
      debounceSave()
    }
  }, [debounceSave])

  useLayoutEffect(() => {
    setSaveOpenedEditorEntries(id, () => saveHandler({ active: true }))

    return () => {
      delSaveOpenedEditorEntries(id)
    }
  }, [debounceSave])

  useEffect(() => {
    const cb = async (payload: EditorViewType) => {
      if (active) {
        if (editorRef.current?.getType() === payload) {
          return
        }

        bus.emit(EVENT.app_save, {
          onSuccess: () => {
            if (payload === EditorViewType.SOURCECODE) {
              const sourceCodeDelegate = createSourceCodeDelegate({
                disableAllBuildInShortcuts: true,
                overrideShortcutMap: useEditorKeybindingStore.getState().editorKeybingMap,
                clipboardReadFunction: clipboardRead,
                onCodemirrorViewLoad: (cmView) => {
                  sourceCodeCodemirrorViewMap.set(curFile.id, cmView)
                  setTimeout(() => {
                    execute('app:toc_refresh')
                  })
                },
              })
              setEditorDelegate(curFile.id, sourceCodeDelegate)
              setDelegate(sourceCodeDelegate)
            } else if (payload === EditorViewType.PREVIEW) {
              debounceRefreshToc()
            } else {
              const wysiwygDelegate = createWysiwygDelegate(
                createWysiwygDelegateOptions(curFile.id),
              )
              setEditorDelegate(curFile.id, wysiwygDelegate)
              setDelegate(wysiwygDelegate)
              debounceRefreshToc()
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
  }, [active, curFile, execute, setEditorDelegate, getEditorContent, debounceRefreshToc])

  useEffect(() => {
    const exportImageHandler = async () => {
      if (!active) {
        return
      }

      save({
        title: t('contextmenu.editor_tab.export_image'),
        defaultPath: curFile.name.split('.')?.[0] + '.jpg',
      }).then(async (path) => {
        if (!path) return

        const n = toast.loading(t('contextmenu.editor_tab.export_image') + '...')

        html2canvas(document.getElementById(id) as HTMLElement).then((canvas) => {
          // to base 64
          const image = canvas.toDataURL('image/jpg')

          const data = canvasDataToBinary(image)

          invoke('write_u8_array_to_file', { filePath: path, content: data })
            .then(() => {
              toast.dismiss(n)
              toast.success('Exported to ' + path)
            })
            .catch((error) => {
              toast.dismiss(n)
              toast.error(String(error))
            })
        })
      })
    }

    const exportHtmlHandler = async () => {
      if (!active) {
        return
      }

      save({
        title: t('contextmenu.editor_tab.export_html'),
        defaultPath: curFile.name.split('.')?.[0] + '.html',
      })
        .then(async (path) => {
          if (!path) return

          const n = toast.loading(t('contextmenu.editor_tab.export_html') + '...')
          const res = await editorRef.current?.exportHtml()
          const scStyled = document.head.querySelectorAll('style[data-styled]')

          const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
  ${scStyled[0].innerHTML}
  </style>
  </head>
  <body style="height: 100vh; overflow: auto;">
  <div class="${document.getElementById(id)?.className}">
  ${res}
  </div>
  </body>
  </html>
          `

          invoke('export_html_to_path', { str: html, path }).then(() => {
            toast.dismiss(n)
            toast.success('Exported to ' + path)
          })
        })
        .catch((error) => {
          toast.error(String(error))
        })
    }

    bus.on('editor_export_html', exportHtmlHandler)
    bus.on('editor_export_image', exportImageHandler)

    return () => {
      bus.detach('editor_export_html', exportHtmlHandler)
      bus.detach('editor_export_image', exportImageHandler)
    }
  }, [active])

  useEffect(() => {
    if (active) {
      debounceRefreshToc()
    }
  }, [active, debounceRefreshToc])

  useEffect(() => {
    if (active) {
      const { addCommand } = useCommandStore.getState()
      addCommand({
        id: 'app_save',
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

    bus.on(EVENT.app_save, callback)

    return () => {
      bus.detach(EVENT.app_save, callback)
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
      initialType: fileTypeConfig?.defaultMode,
      content: content!,
      delegate,
      style: {
        height: '100%',
      },
      wysiwygTextContainerProps: {
        spellCheck: settingData.wysiwyg_editor_spellcheck,
      },
      sourceCodeTextContainerProps: {
        spellCheck: settingData.source_code_editor_spellcheck,
      },
      offset: { top: 10, left: 16 },
      styleToken: {
        id,
        rootFontSize: `${settingData.editor_root_font_size}px`,
        rootLineHeight: settingData.editor_root_line_height,
      },
      onContextMounted: (context: EditorContext) => {
        setEditorCtx(id, context)
      },
      delegateOptions: createWysiwygDelegateOptions(curFile.id),
      wysiwygToolBarOptions: {
        enable: true,
        compProps: {
          style: {
            position: 'sticky',
            top: '0',
            zIndex: 10,
          },
        },
      },
      errorHandler: {
        onError(params) {
          if (params.error) {
            Sentry.captureException(params.error)
          }
        },
      },
    }),
    [content, delegate, setEditorCtx, id, active, settingData, fileTypeConfig],
  )

  const handleChange: EditorChangeHandler = useCallback(
    (params) => {
      const { tr, helpers } = params
      const { getCharacterCount, getWordCount } = helpers

      const characterCount = getCharacterCount()
      const wordCount = getWordCount()

      useEditorCounterStore.getState().addEditorCounter({
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
    [id, debounceSaveHandler, active, debounceRefreshToc, settingData],
  )

  if (status === TextEditorStatus.NOTEXIST) {
    return <WarningHeader>File is not exist</WarningHeader>
  }

  if (typeof content !== 'string') {
    return null
  }

  const cls = classNames('markdown-body', {
    'editor-active': active,
  })

  return (
    <EditorWrapper
      id='editorarea-wrapper'
      className={cls}
      fullWidth={settingData.editor_full_width}
      active={active}
      onClick={handleWrapperClick}
    >
      <MfEditor ref={editorRef} onChange={handleChange} {...editorProps} />
    </EditorWrapper>
  )
}

export interface TextEditorProps {
  id: string
  active: boolean
  fileTypeConfig: FileTypeConfig
  onSave?: () => void
}

export default memo(TextEditor)
