import { describe, expect, it } from 'vitest'
import { getSlashFilterFromTextBeforeCursor } from './utils'

describe('SlashMenu utils', () => {
  it('extracts filter text after the last slash', () => {
    expect(getSlashFilterFromTextBeforeCursor('/table')).toBe('table')
    expect(getSlashFilterFromTextBeforeCursor('hello /表格')).toBe('表格')
    expect(getSlashFilterFromTextBeforeCursor('/one /two')).toBe('two')
  })

  it('rejects text without an active slash query', () => {
    expect(getSlashFilterFromTextBeforeCursor('hello')).toBeNull()
    expect(getSlashFilterFromTextBeforeCursor('/hello world')).toBeNull()
  })
})
