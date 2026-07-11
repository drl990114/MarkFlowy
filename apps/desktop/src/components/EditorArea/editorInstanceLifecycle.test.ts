import { describe, expect, it, vi } from 'vitest'
import { EditorInstanceLifecycle } from './editorInstanceLifecycle'

describe('EditorInstanceLifecycle', () => {
  it('does not clean up a unique tab that remounts in the same turn', () => {
    const microtasks: Array<() => void> = []
    const lifecycle = new EditorInstanceLifecycle((callback) => microtasks.push(callback))
    const cleanup = vi.fn()

    lifecycle.mount('file')
    expect(lifecycle.hasInstances('file')).toBe(true)
    expect(lifecycle.unmount('file', cleanup)).toBe(0)
    expect(cleanup).not.toHaveBeenCalled()

    lifecycle.mount('file')
    microtasks.splice(0).forEach((task) => task())
    expect(lifecycle.hasInstances('file')).toBe(true)
    expect(cleanup).not.toHaveBeenCalled()
  })

  it('cleans up once after the final instance remains unmounted', () => {
    const microtasks: Array<() => void> = []
    const lifecycle = new EditorInstanceLifecycle((callback) => microtasks.push(callback))
    const staleCleanup = vi.fn()
    const finalCleanup = vi.fn()

    lifecycle.mount('file')
    lifecycle.unmount('file', staleCleanup)
    lifecycle.mount('file')
    lifecycle.unmount('file', finalCleanup)

    microtasks.splice(0).forEach((task) => task())
    expect(lifecycle.hasInstances('file')).toBe(false)
    expect(staleCleanup).not.toHaveBeenCalled()
    expect(finalCleanup).toHaveBeenCalledOnce()
  })
})
