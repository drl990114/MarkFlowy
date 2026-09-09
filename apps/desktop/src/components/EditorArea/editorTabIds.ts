export function getEditorTabId(groupId: string, fileId: string) {
  return `mf-editor-tab-${encodeURIComponent(JSON.stringify([groupId, fileId]))}`
}
