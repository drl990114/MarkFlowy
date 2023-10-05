import { useEffect, useMemo } from 'react'

import type { EditorState } from '@/components/EditorArea/editorHooks/EditorState/editor-state'
import { setTitleBarText } from '@/components/TitleBar'

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
      setTitleBarText(title)
    }
  }, [title, active])
}
