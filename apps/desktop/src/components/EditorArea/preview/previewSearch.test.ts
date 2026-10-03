import { expect, it, vi } from 'vitest'
import { openPreviewSearch, registerPreviewSearch } from './previewSearch'

it('routes search to the matching file and pane, and ignores stale cleanup', () => {
  const first = vi.fn()
  const second = vi.fn()
  const cleanup = registerPreviewSearch('pdf', 'left', first)
  const cleanupNew = registerPreviewSearch('pdf', 'left', second)
  cleanup()
  expect(openPreviewSearch('pdf', 'right')).toBe(false)
  expect(openPreviewSearch('pdf', 'left')).toBe(true)
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledTimes(1)
  cleanupNew()
  expect(openPreviewSearch('pdf', 'left')).toBe(false)
})
