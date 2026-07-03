export const EDITOR_TAB_DRAG_TYPE = 'application/x-markflowy-editor-tab'

export interface EditorTabDragData {
  sourceGroupId: string
  fileId: string
}

export function writeEditorTabDragData(dataTransfer: DataTransfer, data: EditorTabDragData) {
  dataTransfer.effectAllowed = 'move'
  dataTransfer.setData(EDITOR_TAB_DRAG_TYPE, JSON.stringify(data))
}

export function hasEditorTabDragData(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes(EDITOR_TAB_DRAG_TYPE)
}

export function readEditorTabDragData(dataTransfer: DataTransfer): EditorTabDragData | undefined {
  const rawData = dataTransfer.getData(EDITOR_TAB_DRAG_TYPE)
  if (!rawData) return undefined

  try {
    const data = JSON.parse(rawData) as Partial<EditorTabDragData>

    if (typeof data.sourceGroupId !== 'string' || typeof data.fileId !== 'string') {
      return undefined
    }

    return {
      sourceGroupId: data.sourceGroupId,
      fileId: data.fileId,
    }
  } catch {
    return undefined
  }
}
