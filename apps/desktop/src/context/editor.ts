import { useEditorStore } from '@/stores'

/**
 * get active editor context
 * @returns {String | null}
 */
export const getActiveEditorContent = () => {
  const { getEditorContent, activeId } = useEditorStore.getState()

  if (activeId === undefined) {
    return null
  }

  return getEditorContent(activeId)
}
