import { describe, expect, it } from 'vitest'
import { getPathIdentityKey } from '../pathIdentity'

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
