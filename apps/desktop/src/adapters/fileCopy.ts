import { invoke } from '@tauri-apps/api/core'
import { dirname } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { t } from '@/i18n'

export async function copySavedFile(from: string, targetFolder?: string): Promise<string> {
  return invoke<string>('copy_file_by_from', { from, targetFolder })
}

export async function selectCopyDirectory(from: string): Promise<string | null> {
  const selected = await open({
    title: t('contextmenu.explorer.copy_to_title'),
    defaultPath: await dirname(from),
    directory: true,
    multiple: false,
    recursive: true,
    fileAccessMode: 'scoped',
  })
  if (selected === null) return null
  await invoke('save_security_bookmark', { path: selected })
  return selected
}
