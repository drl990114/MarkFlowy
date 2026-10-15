import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'

export const exportJson = async (value: unknown, name = 'theme.json') => {
  const path = await save({
    defaultPath: name,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (path) await writeTextFile(path, JSON.stringify(value, null, 2))
}
export const readImport = async (extension: 'json' | 'css') => {
  const path = await open({
    multiple: false,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
    fileAccessMode: 'scoped',
  })
  return typeof path === 'string'
    ? { name: path.split(/[\\/]/).pop() ?? extension, text: await readTextFile(path) }
    : undefined
}
