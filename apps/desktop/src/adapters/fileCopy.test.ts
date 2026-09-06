import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { dirname } from '@tauri-apps/api/path'
import { open } from '@tauri-apps/plugin-dialog'
import { copySavedFile, selectCopyDirectory } from './fileCopy'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({ dirname: vi.fn() }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

beforeEach(() => vi.resetAllMocks())

describe('Desktop file copy adapter', () => {
  it('selects one directory starting beside the source and acquires its existing security bookmark', async () => {
    vi.mocked(dirname).mockResolvedValue('C:\\notes')
    vi.mocked(open).mockResolvedValue('D:\\archive')
    expect(await selectCopyDirectory('C:\\notes\\note.md')).toBe('D:\\archive')
    expect(dirname).toHaveBeenCalledWith('C:\\notes\\note.md')
    expect(open).toHaveBeenCalledWith({
      title: 'contextmenu.explorer.copy_to_title',
      defaultPath: 'C:\\notes',
      directory: true,
      multiple: false,
      recursive: true,
      fileAccessMode: 'scoped',
    })
    expect(invoke).toHaveBeenCalledWith('save_security_bookmark', { path: 'D:\\archive' })
  })

  it('cancels without invoking a filesystem command', async () => {
    vi.mocked(dirname).mockResolvedValue('/notes')
    vi.mocked(open).mockResolvedValue(null)
    expect(await selectCopyDirectory('/notes/note.md')).toBeNull()
    expect(invoke).not.toHaveBeenCalled()
  })

  it.each([undefined, '/archive'])(
    'uses the non-overwriting command with destination %s',
    async (targetFolder) => {
      vi.mocked(invoke).mockResolvedValue('/archive/note copy 2.md')
      expect(await copySavedFile('/notes/note.md', targetFolder)).toBe('/archive/note copy 2.md')
      expect(invoke).toHaveBeenCalledWith('copy_file_by_from', {
        from: '/notes/note.md',
        targetFolder,
      })
    },
  )

  it('propagates native picker and copy failures', async () => {
    vi.mocked(open).mockRejectedValue(new Error('Picker unavailable'))
    await expect(selectCopyDirectory('/notes/note.md')).rejects.toThrow('Picker unavailable')
    vi.mocked(invoke).mockRejectedValue('Permission denied')
    await expect(copySavedFile('/notes/note.md')).rejects.toBe('Permission denied')
  })
})
