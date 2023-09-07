import { verifyFileName } from './verify-file-name'
import { describe, expect } from 'vitest'

describe('verifyFileName', (it) => {
  it('should return true when fileName is valid', () => {
    expect(verifyFileName('test')).toBe(true)
  })

  it('should return false when fileName is invalid', () => {
    expect(verifyFileName('test\\')).toBe(false)
    expect(verifyFileName('test\/')).toBe(false)
    expect(verifyFileName('test:')).toBe(false)
    expect(verifyFileName('test|')).toBe(false)
    expect(verifyFileName('test?')).toBe(false)
  })
})
