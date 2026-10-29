import { describe, expect, it, vi } from 'vitest'
import {
  capricornEditorInstanceRegistry,
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

  it('exposes a visible inactive pane without changing the active compatibility editor', () => {
    const fileId = 'mixed-pane-file'
    const leftEditor = {} as CapricornRuntimeAdapter
    const rightEditor = {} as CapricornRuntimeAdapter
    capricornEditorInstanceRegistry.register(fileId, 'left-instance', leftEditor, 'left')
    setCapricornEditor(fileId, leftEditor)
    const listener = vi.fn()
    const unsubscribe = subscribeCapricornEditors(listener)

    capricornEditorInstanceRegistry.register(fileId, 'right-instance', rightEditor, 'right')
    expect(listener).toHaveBeenCalledOnce()
    expect(getCapricornEditor(fileId)).toBe(leftEditor)
    expect(getCapricornEditor(fileId, 'right')).toBe(rightEditor)
    expect(getCapricornEditor(fileId, 'missing')).toBeUndefined()

    setCapricornEditor(fileId, undefined)
    expect(getCapricornEditor(fileId)).toBeUndefined()
    expect(getCapricornEditor(fileId, 'left')).toBe(leftEditor)
    expect(getCapricornEditor(fileId, 'right')).toBe(rightEditor)
    capricornEditorInstanceRegistry.remove(fileId, 'right-instance')
    expect(listener).toHaveBeenCalledTimes(3)
    expect(getCapricornEditor(fileId, 'right')).toBeUndefined()
    unsubscribe()
    capricornEditorInstanceRegistry.remove(fileId, 'left-instance')
    expect(listener).toHaveBeenCalledTimes(3)
  })
})
