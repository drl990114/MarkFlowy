// This extension is responsible for managing the state of the editor and handle save event.
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
  const { getEditorDelegate, getEditorContent } = useEditorStore()
  const curDelegate = getEditorDelegate(file.id)
  const [state, dispatch] = useReducer(
    editorReducer,
    { note: { content: '', deleted: false }, file },
    initializeState,
  )
  useTitleEffect(state, active)

  const saveHandler = useCallback(async (editorContent?: string) => {
    if (!active) return

    const content = editorContent ?? getEditorContent(file.id)

    console.log('editorContent', content)

    if (!file) return

    try {
      if (!file.path) {
        save({
          title: 'Save File',
          defaultPath: file.name ?? `${t('file.untitled')}.md`,
        }).then((path) => {
          if (path === null) return
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
  }, [active, file, getEditorContent, helpers])

  const saveEventHandler = useCallback(() => {
    saveHandler()
  }, [saveHandler])

  const handleSaveShortcut = useCallback(
    (params: KeyBindingProps) => {
      saveHandler(curDelegate?.docToString(params.state.doc))
      return true // Prevents any further key handlers from being run.
    },
    [curDelegate, saveHandler],
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
  }, [ctx, helpers, curDelegate])

  useEffect(() => {
    const unListenFileSave = listen('file_save', saveEventHandler)
    return () => {
      unListenFileSave.then((fn) => fn())
    }
  }, [saveEventHandler])

  return null
}

interface EditorStateProps {
  active: boolean
  file: IFile
}
