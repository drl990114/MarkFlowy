import { describe, expect, it } from 'vitest'
import { isSupportedImageUrl } from './ImageInsert'

describe('isSupportedImageUrl', () => {
  it('accepts HTTP and HTTPS image URLs', () => {
    expect(isSupportedImageUrl('https://example.com/image.png')).toBe(true)
    expect(isSupportedImageUrl('http://localhost:3000/image')).toBe(true)
  })

  it('rejects local paths and unsupported URL schemes', () => {
    expect(isSupportedImageUrl('/Users/example/image.png')).toBe(false)
    expect(isSupportedImageUrl('file:///Users/example/image.png')).toBe(false)
    expect(isSupportedImageUrl('javascript:alert(1)')).toBe(false)
  })
})
