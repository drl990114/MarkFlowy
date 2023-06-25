// EditorState
// This extension is responsible for managing the state of the editor.
import { useHelpers, useKeymap, useRemirrorContext } from '@remirror/react'
import { invoke } from '@tauri-apps/api'
import { save } from '@tauri-apps/api/dialog'
import { listen } from '@tauri-apps/api/event'
import { t } from 'i18next'
import type { FC } from 'react'
import { useCallback, useEffect, useReducer } from 'react'

import { editorReducer, initializeState } from './editor-state'
import type { IFile } from '@/helper/filesys'
import { useEditorStore } from '@/stores'
import { useTitleEffect } from '@/hooks/useTitleEffect'
import type { KeyBindingProps } from '@remirror/core'

export const useEditorState: FC<EditorStateProps> = ({ active, file }) => {
  const ctx = useRemirrorContext()
  const helpers = useHelpers()
  const { getEditorContent } = useEditorStore()
  const [state, dispatch] = useReducer(
    editorReducer,
    { note: { content: '', deleted: false }, file },
    initializeState,
  )

  useTitleEffect(state, true)

  const { } = useHelpers()

  const handleSaveShortcut = useCallback(
    (params: KeyBindingProps) => {
      console.log('save',params)

      return true // Prevents any further key handlers from being run.
    },
    [],
  )

  // "Mod" means platform agnostic modifier key - i.e. Ctrl on Windows, or Cmd on MacOS
  useKeymap('Mod-s', handleSaveShortcut)

  useEffect(() => {
    ctx.manager.addHandler('stateUpdate', (params) => {
      const { tr } = params

      if (tr?.docChanged && !tr.getMeta('APPLY_MARKS')) {
        dispatch({
          type: 'EDIT_CONTENT',
          payload: { undoDepth: helpers.undoDepth() },
        })
      }
    })
  }, [ctx, helpers])

  useEffect(() => {
    const unListenFileSave = listen('file_save', async () => {
      if (!active) return

      const content = getEditorContent(file.id)

      if (!file) return

      try {
        if (!file.path) {
          save({
            title: 'Save File',
            defaultPath: file.name ?? `${t('file.untitled')}.md`,
          }).then((path) => {
            if (path === null) return
            console.log('save', path)
            invoke('write_file', { filePath: path, content })
            dispatch({
              type: 'SAVE_CONTENT',
              payload: { content, undoDepth: helpers.undoDepth() },
            })
          })
        } else {
          invoke('write_file', { filePath: file.path, content })
          dispatch({
            type: 'SAVE_CONTENT',
            payload: { content, undoDepth: helpers.undoDepth() },
          })
        }
      } catch (error) {
        console.error(error)
      }
    })
    return () => {
      unListenFileSave.then((fn) => fn())
    }
  }, [active, file, dispatch, helpers])

  return null
}

interface EditorStateProps {
  active: boolean
  file: IFile
}
