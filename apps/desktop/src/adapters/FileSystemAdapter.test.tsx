import { cleanup, renderHook } from '@testing-library/react'
import { invoke } from '@tauri-apps/api/core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useFileSystem } from '../../../../packages/interface/src/contexts/FileSystemContext'
import { FileResultCode } from '../../../../packages/interface/src/types/file'
import { hydrateDirectoryEntries } from '@/helper/filesys'
import type * as FileSystem from '@/helper/filesys'
import { TauriFileSystemProvider } from './FileSystemAdapter'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@markflowy/interface', async () => ({
  ...(await import('../../../../packages/interface/src/contexts/AppContext')),
  ...(await import('../../../../packages/interface/src/contexts/FileSystemContext')),
  ...(await import('../../../../packages/interface/src/types/file')),
}))
vi.mock('@/stores', () => ({
  useEditorStore: { getState: () => ({ getRootPath: () => '/workspace' }) },
}))
vi.mock('@/stores/useAppSettingStore', () => ({ default: () => '' }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/helper/files', () => ({
  getFileObject: vi.fn(),
  getFileObjectByPath: vi.fn(),
  setFileObjects: vi.fn(),
  setFileObjectsByPath: vi.fn(),
}))
vi.mock('@/helper/filesys', async (importOriginal) => ({
  ...(await importOriginal<typeof FileSystem>()),
  hydrateDirectoryEntries: vi.fn((entries) => entries),
}))
vi.mock('./fileCopy', () => ({ copySavedFile: vi.fn(), selectCopyDirectory: vi.fn() }))

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)

describe('Desktop directory read failures', () => {
  it('propagates a backend read failure so the tree can retry instead of caching an empty listing', async () => {
    vi.mocked(invoke).mockResolvedValue({ code: FileResultCode.PermissionDenied, entries: [] })
    const { result } = renderHook(() => useFileSystem(), { wrapper: TauriFileSystemProvider })
    await expect(result.current.readSubdirectory('/workspace/target')).rejects.toThrow('PermissionDenied')
    expect(hydrateDirectoryEntries).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenCalledWith('open_folder_async', {
      folderPath: '/workspace/target', rootPath: '/workspace', fileExcludePatterns: '',
    })
  })

  it('still treats a successfully read empty directory as an empty listing', async () => {
    vi.mocked(invoke).mockResolvedValue({ code: FileResultCode.Success, entries: [] })
    const { result } = renderHook(() => useFileSystem(), { wrapper: TauriFileSystemProvider })
    await expect(result.current.readSubdirectory('/workspace/target')).resolves.toEqual([])
    expect(hydrateDirectoryEntries).toHaveBeenCalledWith([])
  })
})
