import { describe, expect, it } from 'vitest'
import { getPathIdentityKey, rebaseFilePath } from '../pathIdentity'

describe('getPathIdentityKey', () => {
  it('normalizes Windows separators and casing', () => {
    expect(getPathIdentityKey('C:\\Workspace\\Notes\\File.md')).toBe('c:/workspace/notes/file.md')
    expect(getPathIdentityKey('c:/workspace/notes/file.md/')).toBe('c:/workspace/notes/file.md')
  })

  it('preserves POSIX casing because the volume may be case-sensitive', () => {
    expect(getPathIdentityKey('/Workspace/Foo.md')).toBe('/Workspace/Foo.md')
    expect(getPathIdentityKey('/Workspace/foo.md')).toBe('/Workspace/foo.md')
  })
})

describe('rebaseFilePath', () => {
  it('requires a path boundary, retains case and supports root paths', () => {
    expect(rebaseFilePath('/work/old/A.md', '/work/old/', '/work/new')).toBe('/work/new/A.md')
    expect(rebaseFilePath('/work/older/A.md', '/work/old', '/work/new')).toBeUndefined()
    expect(rebaseFilePath('/work/old', '/work/old', '/work/new')).toBe('/work/new')
    expect(rebaseFilePath('/A.md', '/', '/new')).toBe('/new/A.md')
    expect(rebaseFilePath('/old/A.md', '/old', '/')).toBe('/A.md')
  })

  it('handles Windows separator aliases, UNC paths and duplicate separators', () => {
    expect(rebaseFilePath('C:\\Work\\Old\\A.md', 'c:/work/old', 'C:\\Work\\New')).toBe(
      'C:\\Work\\New\\A.md',
    )
    expect(rebaseFilePath('C:\\A.md', 'c:/', 'D:\\')).toBe('D:\\A.md')
    expect(
      rebaseFilePath(
        '\\\\Server\\Share\\Old\\A.md',
        '\\\\server\\share\\old',
        '\\\\Server\\Share\\New',
      ),
    ).toBe('\\\\Server\\Share\\New\\A.md')
    expect(rebaseFilePath('/work//old///A.md', '/work/old', '/work/new')).toBe('/work/new/A.md')
  })
})
