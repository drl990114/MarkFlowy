import { useEffect, useMemo } from 'react'

import type { EditorState } from '@linebyline/editor/types'
import { appWindow } from '@tauri-apps/api/window'

export function useTitleEffect(state: EditorState, active: boolean): void {
  const title = useMemo(() => {
    let newTitle = state.file.name || 'Untitled'

    if (state.hasUnsavedChanges) {
      newTitle = `${newTitle} - Edited`
    }
    return newTitle
  }, [state.hasUnsavedChanges, state.file])

  useEffect(() => {
    if (active) {
      appWindow.setTitle(title)
    }
  }, [title, active])
}
