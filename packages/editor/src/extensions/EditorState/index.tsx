// EditorState
// This extension is responsible for managing the state of the editor.
// TODO It will be split later and passed in through props expansion. instead of built in editor.
// @ts-nocheck
import { useTitleEffect } from '@/hooks/useTitleEffect'
import { useEditorStore } from '@/stores'
import { RemirrorManager } from '@remirror/core'
import { useHelpers } from '@remirror/react'
import { invoke } from '@tauri-apps/api'
import { save } from '@tauri-apps/api/dialog'
import { listen } from '@tauri-apps/api/event'
import { t } from 'i18next'
import { FC, useEffect, useReducer } from 'react'

import { editorReducer, initializeState } from './editor-state'

export const EditorState: FC<EditorStateProps> = ({ active, file, manager }) => {
  const helpers = useHelpers()
  const { getEditorContent } = useEditorStore()
  const [state, dispatch] = useReducer(editorReducer, { note: { content: '', deleted: false }, file }, initializeState)

  useTitleEffect(state, active)

  useEffect(() => {
    manager.addHandler('stateUpdate', (params) => {
      const { tr } = params

      if (tr?.docChanged && !tr.getMeta('RINO_APPLY_MARKS')) {
        dispatch({ type: 'EDIT_CONTENT', payload: { undoDepth: helpers.undoDepth() } })
      }
    })
  }, [manager])

  useEffect(() => {
    const unListenFileSave = listen('file_save', async () => {
      if (!active) {
        return
      }

      const content = getEditorContent(file.id)

      if (!file) {
        return
      }

      try {
        if (!file.path) {
          save({
            title: 'Save File',
            defaultPath: file.name ?? `${t('file.untitled')}.md`,
          }).then((path) => {
            if (path === null) return
            invoke('write_file', { filePath: file.path, content })
            dispatch({ type: 'SAVE_CONTENT', payload: { content, undoDepth: helpers.undoDepth() } })
          })
          return
        } else {
          invoke('write_file', { filePath: file.path, content })
          dispatch({ type: 'SAVE_CONTENT', payload: { content, undoDepth: helpers.undoDepth() } })
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
  file: Global.IFile
  /**
   * import { RemirrorManager } from '@remirror/core', 
   * The type introduced here will have a private attribute error, you need to understand the reason. 
   */
  manager: RemirrorManager<any>
}