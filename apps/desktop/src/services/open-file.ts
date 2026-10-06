import { getFileNameFromPath } from '@/helper/filesys'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorStore from '@/stores/useEditorStore'
import { invoke } from '@tauri-apps/api/core'
import { addExistingMarkdownFileEdit } from './editor-file'

export type FileOpenTarget = 'current' | 'preference'

/** Window bootstrap and explicitly targeted CLI requests already own their target. */
export async function openStandaloneFile(
  path: string,
  target: FileOpenTarget = 'preference',
): Promise<'current' | 'new'> {
  const rootPath = useEditorStore.getState().getRootPath()
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
