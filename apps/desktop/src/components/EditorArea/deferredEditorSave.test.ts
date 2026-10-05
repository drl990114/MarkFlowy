import { describe, expect, it, vi } from 'vitest'
import { completeDeferredEditorSave, getDeferredEditorSave, registerDeferredEditorSave } from './deferredEditorSave'

describe('saving an unvisited editor', () => {
  it('coalesces save demand and uses the existing save handler after mounting', async () => {
    const mount = vi.fn()
    const stop = registerDeferredEditorSave('file', mount)
    const request = getDeferredEditorSave('file')!
    try {
      const first = request()
      expect(request()).toBe(first)
      expect(mount).toHaveBeenCalledOnce()
      const save = vi.fn(async () => true)
      completeDeferredEditorSave('file', save)
      await expect(first).resolves.toBe(true)
      expect(save).toHaveBeenCalledOnce()
    } finally { stop() }
  })

  it('cancels a pending save when its last view closes, without hanging the close operation', async () => {
    const first = registerDeferredEditorSave('siblings', vi.fn())
    const last = registerDeferredEditorSave('siblings', vi.fn())
    const request = getDeferredEditorSave('siblings')!()
    first()
    expect(getDeferredEditorSave('siblings')).toBeTypeOf('function')
    last()
    await expect(request).resolves.toBe(false)
    expect(getDeferredEditorSave('siblings')).toBeUndefined()
  })

  it('settles unsupported files as unsaved and allows a later retry', async () => {
    const stop = registerDeferredEditorSave('unsupported', vi.fn())
    try {
      const request = getDeferredEditorSave('unsupported')!()
      completeDeferredEditorSave('unsupported')
      await expect(request).resolves.toBe(false)
      const retry = getDeferredEditorSave('unsupported')!()
      completeDeferredEditorSave('unsupported', async () => true)
      await expect(retry).resolves.toBe(true)
    } finally { stop() }
  })
})
