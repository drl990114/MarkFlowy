import { describe, expect, it } from 'vitest'
import { countNonWhitespaceCharacters } from '../editorCounter'

describe('countNonWhitespaceCharacters', () => {
  it('excludes spaces and line breaks', () => {
    expect(countNonWhitespaceCharacters('Mark Flowy\n编辑器\r\n')).toBe(12)
  })

  it('excludes other Unicode whitespace', () => {
    expect(countNonWhitespaceCharacters('\t\u00a0\u3000')).toBe(0)
  })

  it('keeps the existing UTF-16 character semantics', () => {
    expect(countNonWhitespaceCharacters(' A😀 ')).toBe(3)
  })
})
