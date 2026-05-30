import { describe, it, expect, vi } from 'vitest'

vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({ getRootPath: () => '' }),
  },
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(),
}))

vi.mock('rme', () => ({}))

vi.mock('antd', () => ({}))

vi.mock('@markflowy/interface', () => ({
  FileResultCode: { Success: 0 },
}))

vi.mock('../files', () => ({
  getFileObjectByPath: vi.fn(),
  setFileObject: vi.fn(),
  setFileObjectByPath: vi.fn(),
}))

import { getFileNameFromPath, getFolderPathFromPath, isMdFile } from '../filesys'

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
})
