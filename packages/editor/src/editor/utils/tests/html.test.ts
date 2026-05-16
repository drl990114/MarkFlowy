import { describe, it, expect } from 'vitest'
import { getTagName, isClosingTag } from '../html'

describe('utils/html', () => {
  it('getTagName', () => {
    expect(getTagName('<p>')).toBe('p')
    expect(getTagName('</p>')).toBe('p')
    expect(getTagName('<p class="test">')).toBe('p')
    expect(getTagName('<h1 class="test" id="test">')).toBe('h1')
    expect(getTagName('<span class="test" id="test" data-test="test">')).toBe('span')
    expect(getTagName('<img >')).toBe('img')
  })

  it('isClosingTag', () => {
    expect(isClosingTag('<p>')).toBe(false)
    expect(isClosingTag('</p>')).toBe(true)
    expect(isClosingTag('<p class="test">')).toBe(false)
    expect(isClosingTag('<h1 class="test" id="test">')).toBe(false)
    expect(isClosingTag('</h1>')).toBe(true)
    expect(isClosingTag('<span class="test" id="test" data-test="test">')).toBe(false)
    expect(isClosingTag('<img >')).toBe(false)
  })
})
