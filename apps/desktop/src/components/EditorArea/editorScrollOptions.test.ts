import { describe, expect, it } from 'vitest'
import { editorScrollOptions } from './editorScrollOptions'

describe('editor scroll ownership', () => {
  it('allows wide-table horizontal navigation on the same viewport', () => {
    expect(editorScrollOptions.overflow).toEqual({ x: 'scroll', y: 'scroll' })
    expect(editorScrollOptions.scrollbars.visibility).toBe('auto')
    expect(editorScrollOptions.scrollbars.dragScroll).toBe(true)
    expect(editorScrollOptions.scrollbars.theme).toBe('os-theme-markflowy')
  })
})
