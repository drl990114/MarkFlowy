import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({ getRootPath: () => '' }),
  },
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('rme', () => ({}))

vi.mock('@markflowy/interface', () => ({
  FileResultCode: {
    Success: 'Success',
    NotFound: 'NotFound',
  },
}))

vi.mock('../files', () => ({
  deletePathEntry: vi.fn(),
  getFileObject: vi.fn(),
  getFileObjectByPath: vi.fn(),
  setFileObject: vi.fn(),
  setFileObjectByPath: vi.fn(),
  setFileObjects: vi.fn(),
  setFileObjectsByPath: vi.fn(),
}))

import {
  deletePathEntry,
  getFileObject,
  getFileObjectByPath,
  setFileObject,
  setFileObjectByPath,
  setFileObjects,
  setFileObjectsByPath,
} from '../files'
import {
  FileResultCode,
  getFileNameFromPath,
  getFolderPathFromPath,
  hydrateDirectoryEntries,
  isMdFile,
  unwrapDirectoryReadResult,
  updateFile,
  type DirectoryReadEntry,
} from '../filesys'

describe('test helper/filesys ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getFileObjectByPath).mockReturnValue(undefined)
  })

  it('getFileNameFromPath', () => {
    const macPath = '/path/to/myfile.txt'
    const winPath = 'C:\\path\\to\\myfile.txt'

    expect(getFileNameFromPath(macPath)).toBe('myfile.txt')
    expect(getFileNameFromPath(winPath)).toBe('myfile.txt')
  })

  it('isMdFile', () => {
    const macPath = '/path/to/myfile.md'
    const winPath = 'C:\\path\\to\\myfile.md'
    const otherPath = 'C:\\path\\to\\myfile.txt'

    expect(isMdFile(macPath)).toBe(true)
    expect(isMdFile(winPath)).toBe(true)
    expect(isMdFile(otherPath)).toBe(false)
  })

  it('getFolderPathFromPath', () => {
    const macPath = '/path/to/myfile.txt'
    const winPath = 'C:\\path\\to\\myfile.txt'

    expect(getFolderPathFromPath(macPath)).toBe('/path/to')
    expect(getFolderPathFromPath(winPath)).toBe('C:\\path\\to')
  })

  it('merges rename metadata without dropping cached file content', () => {
    vi.mocked(getFileObject).mockReturnValue({
      id: 'file-1',
      name: 'before.md',
      kind: 'file',
      path: '/workspace/before.md',
      ext: 'md',
      content: 'cached content',
    })

    const renamedFile = updateFile({
      id: 'file-1',
      name: 'after.md',
      kind: 'file',
      path: '/workspace/after.md',
    })

    expect(renamedFile).toEqual({
      id: 'file-1',
      name: 'after.md',
      kind: 'file',
      path: '/workspace/after.md',
      ext: 'md',
      content: 'cached content',
    })
    expect(deletePathEntry).toHaveBeenCalledWith('/workspace/before.md')
    expect(setFileObject).toHaveBeenCalledWith('file-1', renamedFile)
    expect(setFileObjectByPath).toHaveBeenCalledWith('/workspace/after.md', renamedFile)
  })

  it('unwraps the structured directory result without parsing JSON', () => {
    const entries: DirectoryReadEntry[] = [
      {
        name: 'notes.md',
        kind: 'file',
        path: '/workspace/notes.md',
        children: null,
        ext: 'md',
      },
    ]

    expect(unwrapDirectoryReadResult({ code: FileResultCode.Success, entries })).toBe(entries)
  })

  it('keeps directory read failures explicit', () => {
    expect(() =>
      unwrapDirectoryReadResult({
        code: FileResultCode.NotFound,
        entries: [],
        message: 'Failed to read directory',
      }),
    ).toThrow('Failed to read directory: NotFound (Failed to read directory)')
  })

  it('hydrates nested directory entries and preserves cached ids', () => {
    vi.mocked(getFileObjectByPath).mockImplementation((path) =>
      path === '/workspace/folder/notes.md'
        ? {
            id: 'cached-file-id',
            name: 'notes.md',
            kind: 'file',
            path,
            ext: 'md',
          }
        : undefined,
    )

    const files = hydrateDirectoryEntries([
      {
        name: 'folder',
        kind: 'dir',
        path: '/workspace/folder',
        children: [
          {
            name: 'notes.md',
            kind: 'file',
            path: '/workspace/folder/notes.md',
            children: null,
            ext: 'md',
          },
        ],
        ext: '',
      },
    ])

    expect(files[0].id).toEqual(expect.any(String))
    expect(files[0].children?.[0].id).toBe('cached-file-id')
    expect(files[0].children?.[0].children).toBeUndefined()
    expect(setFileObjects).toHaveBeenCalledWith([
      { id: files[0].id, file: files[0] },
      { id: 'cached-file-id', file: files[0].children?.[0] },
    ])
    expect(setFileObjectsByPath).toHaveBeenCalledWith([
      { path: '/workspace/folder', file: files[0] },
      { path: '/workspace/folder/notes.md', file: files[0].children?.[0] },
    ])
  })
})
