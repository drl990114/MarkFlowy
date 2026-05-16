import { arrayExclude } from '../common'
import { describe, it, expect } from 'vitest'

describe('utils/common', () => {
  it('arrayExclude', () => {
    expect(arrayExclude([1, 2, 3], [3, 4, 5])).toEqual([1, 2])
    expect(arrayExclude(['1', '2', 3], ['1', 2, 3])).toEqual(['2'])
  })
})
