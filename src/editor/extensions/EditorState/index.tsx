// EditorState
// This extension is responsible for managing the state of the editor.
// TODO It will be split later and passed in through props expansion. instead of built in editor.

import { useTitleEffect } from '@/hooks/useTitleEffect'
import { useEditorStore } from '@/stores'
import { IFile } from '@/utils/filesys'
import { useHelpers } from '@remirror/react'
import { save } from '@tauri-apps/api/dialog'
import { listen } from '@tauri-apps/api/event'
import { writeTextFile } from '@tauri-apps/api/fs'
import { t } from 'i18next'
import { FC, useEffect, useReducer } from 'react'
import { RemirrorManager } from 'remirror'
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
      const content = active ? getEditorContent(file.id) : ''

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
            writeTextFile(path, content)
            dispatch({ type: 'SAVE_CONTENT', payload: { content, undoDepth: helpers.undoDepth() } })
          })
          return
        }

        writeTextFile(file.path!, content)
        dispatch({ type: 'SAVE_CONTENT', payload: { content, undoDepth: helpers.undoDepth() } })
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
  manager: RemirrorManager<any>
}
