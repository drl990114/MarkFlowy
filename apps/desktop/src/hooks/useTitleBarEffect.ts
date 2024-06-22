import { setTitleBarText } from '@/components/TitleBar'
import { useEditorStateStore, useEditorStore } from '@/stores'
import { getFileObject } from '@/helper/files'

export function useTitleBarEffect(): void {
  const { activeId } = useEditorStore()
  const { idStateMap } = useEditorStateStore()

  if (!activeId) return setTitleBarText('MarkFlowy')

  const state = idStateMap.get(activeId)

  const file = getFileObject(activeId)

  if (!file) return setTitleBarText('MarkFlowy')

  let title = file.name || 'Untitled'

  if (state?.hasUnsavedChanges) {
    title = `${title} - Edited`
  }

  setTitleBarText(title)
}
