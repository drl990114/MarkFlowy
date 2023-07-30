import { describe, it, expect } from 'vitest'
import { replaceNewLines } from "./table-extension"

describe('test replaceNewLines function', () => {
  it('replaceNewLines', () => {
    const text = 'a\nb\nc'
    expect(replaceNewLines(text)).toBe('abc')
  })
})
