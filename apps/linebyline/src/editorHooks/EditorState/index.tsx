// EditorState
// This extension is responsible for managing the state of the editor.
import { useTitleEffect } from '@/hooks/useTitleEffect'
import { useEditorStore } from '@/stores'
import { useHelpers, useRemirrorContext } from '@remirror/react'
import { invoke } from '@tauri-apps/api'
import { save } from '@tauri-apps/api/dialog'
import { listen } from '@tauri-apps/api/event'
import { t } from 'i18next'
import { FC, useEffect, useReducer } from 'react'

import { IFile } from '@/helper/filesys'
import { editorReducer, initializeState } from './editor-state'

export const useEditorState: FC<EditorStateProps> = ({ active, file }) => {
  console.log('useEditorState', active, file)
  const ctx = useRemirrorContext()
  const helpers = useHelpers()
  const { getEditorContent } = useEditorStore()
  const [state, dispatch] = useReducer(editorReducer, { note: { content: '', deleted: false }, file }, initializeState)

  useTitleEffect(state, true)

  useEffect(() => {
    ctx.manager.addHandler('stateUpdate', (params) => {
      const { tr } = params

      if (tr?.docChanged && !tr.getMeta('RINO_APPLY_MARKS')) {
        dispatch({ type: 'EDIT_CONTENT', payload: { undoDepth: helpers.undoDepth() } })
      }
    })
  }, [ctx])

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
            console.log('save', path)
            invoke('write_file', { filePath: path, content })
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
  file: IFile
}
