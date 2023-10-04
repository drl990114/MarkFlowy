// This extension is responsible for managing the state of the editor and handle save event.
import { useHelpers, useRemirrorContext } from '@linebyline/editor'
import { invoke } from '@tauri-apps/api'
import { save } from '@tauri-apps/plugin-dialog'
import { t } from 'i18next'
import type { FC } from 'react'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { editorReducer, initializeState } from './editor-state'
import { getFileNameFromPath, type IFile } from '@/helper/filesys'
import { useCommandStore, useEditorStateStore, useEditorStore } from '@/stores'
import { useTitleEffect } from '@/hooks/useTitleEffect'
import { useGlobalSettingData } from '@/hooks'
import { debounce } from 'lodash'
import { updateFileObject } from '@/helper/files'
import bus from '@/helper/eventBus'
import { EVENT } from '@/constants'

type SaveHandlerParams = {
  onSuccess?: () => void
}

export const useEditorState: FC<EditorStateProps> = ({ active, file }) => {
  const ctx = useRemirrorContext()
  const [settingData] = useGlobalSettingData()
  const helpers = useHelpers()
  const { getEditorDelegate, getEditorContent, insertNodeToFolderData } = useEditorStore()
  const { setIdStateMap } = useEditorStateStore()
  const curDelegate = getEditorDelegate(file.id)
  const { addCommand, execute } = useCommandStore()
  const [state, dispatch] = useReducer(
    editorReducer,
    { note: { content: '', deleted: false }, file },
    initializeState,
  )
  useTitleEffect(state, active)

  useEffect(() => {
    if (active) {
      setIdStateMap(file.id, state)
    }
  }, [state, file.id, setIdStateMap, active])

  const saveHandler = useCallback(
    async ({ onSuccess }: SaveHandlerParams = {}) => {
      if (!active) return

      const content = getEditorContent(file.id)

      console.log('editorContent', content)

      if (!file) return

      try {
        if (!file.path) {
          save({
            title: 'Save File',
            defaultPath: file.name ?? `${t('file.untitled')}.md`,
          }).then((path) => {
            if (path === null) return
            const filename = getFileNameFromPath(path)
            updateFileObject(file.id, { ...file, path, name: filename })
            insertNodeToFolderData({ ...file, name: filename, content, path })
            invoke('write_file', { filePath: path, content }).then(() => {
              onSuccess?.()
            })
            dispatch({
              type: 'SAVE_CONTENT',
              payload: { content, undoDepth: helpers.undoDepth() },
            })
          })
        } else {
          invoke('write_file', { filePath: file.path, content }).then(() => {
            onSuccess?.()
          })
          dispatch({
            type: 'SAVE_CONTENT',
            payload: { content, undoDepth: helpers.undoDepth() },
          })
        }
      } catch (error) {
        console.error(error)
      }
    },
    [active, file, getEditorContent, helpers, insertNodeToFolderData],
  )

  const debounceSave = useMemo(
    () => debounce(() => saveHandler(), settingData.autosave_interval),
    [settingData.autosave_interval, saveHandler],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceSaveHandler = useCallback(debounceSave, [settingData, debounceSave])

  useEffect(() => {
    if (active) {
      addCommand({
        id: 'editor:save',
        handler: () => {
          saveHandler()
        },
      })
    }
  }, [active, addCommand, saveHandler])

  useEffect(() => {
    const unsubscribe = ctx.manager.addHandler('stateUpdate', (params) => {
      const { tr } = params
      if (tr?.docChanged && !tr.getMeta('APPLY_MARKS')) {
        execute('app:toc_refresh')
        dispatch({
          type: 'EDIT_CONTENT',
          payload: { undoDepth: helpers.undoDepth() },
        })
        if (settingData.autosave && active) {
          debounceSaveHandler()
        }
      }
    })
    execute('app:toc_refresh')
    return () => {
      unsubscribe()
    }
  }, [ctx, helpers, curDelegate, active, settingData, saveHandler, debounceSaveHandler, execute])

  useEffect(() => {
    const callback = (hooks: SaveHandlerParams) => {
      saveHandler({ onSuccess: hooks?.onSuccess })
    }

    bus.on(EVENT.editor_save, callback)

    return () => {
      bus.detach(EVENT.editor_save, callback)
    }
  }, [saveHandler])

  return null
}

interface EditorStateProps {
  active: boolean
  file: IFile
}
