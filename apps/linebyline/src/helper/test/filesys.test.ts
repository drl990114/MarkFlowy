import { describe, it, expect } from 'vitest'
import { getFileNameFromPath, isMdFile } from '../filesys'

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
})
