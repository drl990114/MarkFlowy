import { useEffect, useMemo } from 'react'

import { EditorState } from '@/editor/types'
import { appWindow } from '@tauri-apps/api/window'

export function useTitleEffect(state: EditorState, active: boolean): void {
  const title = useMemo(() => {
    let title = state.file.name || 'Untitled'

    if (state.hasUnsavedChanges) {
      title = `${title} - Edited`
    }
    return title
  }, [state.hasUnsavedChanges, state.file])

  useEffect(() => {
    if (active) {
      appWindow.setTitle(title)
    }
  }, [title, active])
}
