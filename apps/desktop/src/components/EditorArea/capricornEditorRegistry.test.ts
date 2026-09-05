import { describe, expect, it, vi } from 'vitest'
import {
  getCapricornEditor,
  setCapricornEditor,
  subscribeCapricornEditors,
} from './capricornEditorRegistry'
import type { CapricornRuntimeAdapter } from './capricornRuntimeAdapter'

describe('capricornEditorRegistry', () => {
  it('publishes current editor changes without duplicating notifications', () => {
    const editor = {} as CapricornRuntimeAdapter
    const listener = vi.fn()
    const unsubscribe = subscribeCapricornEditors(listener)

    setCapricornEditor('file', editor)
    expect(getCapricornEditor('file')).toBe(editor)
    expect(listener).toHaveBeenCalledOnce()

    setCapricornEditor('file', editor)
    expect(listener).toHaveBeenCalledOnce()

    setCapricornEditor('file', undefined)
    expect(getCapricornEditor('file')).toBeUndefined()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
  })
})
