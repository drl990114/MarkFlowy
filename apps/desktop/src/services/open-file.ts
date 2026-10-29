import { getFileNameFromPath } from '@/helper/filesys'
import { getFileIdsByPathIdentity, getFileObjectByPath } from '@/helper/files'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorStore, { type EditorLayoutLeaf, type EditorLayoutNode } from '@/stores/useEditorStore'
import { invoke } from '@tauri-apps/api/core'
import { addExistingMarkdownFileEdit } from './editor-file'

export type FileOpenTarget = 'current' | 'preference'

const findOpenedGroup = (node: EditorLayoutNode, id: string): EditorLayoutLeaf | undefined => {
  if (node.type === 'leaf') return node.opened.includes(id) ? node : undefined
  for (const child of node.children) {
    const group = findOpenedGroup(child, id)
    if (group) return group
  }
}

/** Window bootstrap and explicitly targeted CLI requests already own their target. */
export async function openStandaloneFile(
  path: string,
  target: FileOpenTarget = 'preference',
): Promise<'current' | 'new'> {
  const editor = useEditorStore.getState()
  const cachedFile = getFileObjectByPath(path)
  const existingId = cachedFile && editor.opened.includes(cachedFile.id)
    ? cachedFile.id
    : getFileIdsByPathIdentity(path).find((id) => editor.opened.includes(id))
  if (existingId) {
    const activeGroup = editor.getActiveGroup()
    const group = activeGroup?.opened.includes(existingId)
      ? activeGroup
      : findOpenedGroup(editor.editorLayout, existingId)
    if (group) {
      // Reopening a file activates its existing pane and keeps any unsaved body.
      editor.openFileInGroup(group.id, existingId, { mode: 'permanent' })
      return 'current'
    }
  }

  const rootPath = editor.getRootPath()
  const preferNewWindow = target === 'preference' &&
    useAppSettingStore.getState().settingData.open_file_in_new_window !== false
  const belongsToWorkspace = preferNewWindow && rootPath
    ? await invoke<boolean>('is_file_in_workspace', { path, rootPath })
    : false
  if (preferNewWindow && belongsToWorkspace !== true) {
    // The workspace helper also records recent folders; files must not enter that list.
    await invoke<string>('create_new_window', { path })
    return 'new'
  }

  const fileName = getFileNameFromPath(path) || 'new-file.md'
  const dotIndex = fileName.lastIndexOf('.')
  await addExistingMarkdownFileEdit({
    fileName,
    ext: dotIndex > -1 ? fileName.slice(dotIndex + 1) : '',
    path,
  })
  return 'current'
}
