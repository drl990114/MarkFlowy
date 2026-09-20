const searchHandlers = new Map<string, () => void>()
const keyFor = (fileId: string, groupId?: string) => JSON.stringify([groupId, fileId])

export function registerPreviewSearch(
  fileId: string,
  groupId: string | undefined,
  focus: () => void,
) {
  const key = keyFor(fileId, groupId)
  searchHandlers.set(key, focus)
  return () => {
    if (searchHandlers.get(key) === focus) searchHandlers.delete(key)
  }
}

export function openPreviewSearch(fileId: string, groupId?: string): boolean {
  const focus = searchHandlers.get(keyFor(fileId, groupId))
  if (!focus) return false
  focus()
  return true
}
