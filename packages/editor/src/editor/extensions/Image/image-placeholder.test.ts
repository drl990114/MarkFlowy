import { describe, expect, it } from 'vitest'
import { getImageSourceLabel } from './image-placeholder'

describe('getImageSourceLabel', () => {
  it('keeps placeholders compact and never exposes embedded image payloads', () => {
    expect(getImageSourceLabel('https://cdn.example.com/path/image.png')).toBe('cdn.example.com')
    expect(getImageSourceLabel('../assets/image.png')).toBe('image.png')
    expect(getImageSourceLabel(`data:image/png;base64,${'A'.repeat(4096)}`)).toBeNull()
  })
})
