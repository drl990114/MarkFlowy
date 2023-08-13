import { describe, it, expect } from 'vitest'
import { once } from '../common'

describe('test helper/common ', () => {
  it('once', () => {
    let count = 0
    const fn = once(() => {
      count++
    })
    fn()
    fn()
    fn()
    expect(count).toBe(1)
  })
})
