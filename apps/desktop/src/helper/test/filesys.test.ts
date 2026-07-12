import { describe, it, expect, vi } from 'vitest'

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
  FileResultCode: { Success: 0 },
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
  setFileObject,
  setFileObjectByPath,
} from '../files'
import { getFileNameFromPath, getFolderPathFromPath, isMdFile, updateFile } from '../filesys'

describe('test helper/filesys ', () => {
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
})
