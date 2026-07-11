import { describe, expect, it, vi } from 'vitest'
import { runSaveOperation } from './runSaveOperation'

describe('runSaveOperation', () => {
  it('does not resolve or fire callbacks before the underlying save completes', async () => {
    let finishSave: ((saved: boolean) => void) | undefined
    const operation = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finishSave = resolve
        }),
    )
    const onSuccess = vi.fn()
    const onFinally = vi.fn()
    let resolved = false

    const pendingSave = runSaveOperation(operation, { onSuccess, onFinally })
    void pendingSave.then(() => {
      resolved = true
    })

    await Promise.resolve()
    expect(resolved).toBe(false)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFinally).not.toHaveBeenCalled()

    finishSave?.(true)
    await expect(pendingSave).resolves.toBe(true)

    expect(onSuccess).toHaveBeenCalledOnce()
    expect(onFinally).toHaveBeenCalledOnce()
  })

  it('fires only finally when a save is canceled or fails', async () => {
    const onSuccess = vi.fn()
    const onFinally = vi.fn()

    await expect(runSaveOperation(async () => false, { onSuccess, onFinally })).resolves.toBe(false)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFinally).toHaveBeenCalledOnce()
  })

  it('fires finally once and preserves an operation error', async () => {
    const onSuccess = vi.fn()
    const onFinally = vi.fn()
    const error = new Error('write failed')

    await expect(
      runSaveOperation(
        async () => {
          throw error
        },
        { onSuccess, onFinally },
      ),
    ).rejects.toBe(error)

    expect(onSuccess).not.toHaveBeenCalled()
    expect(onFinally).toHaveBeenCalledOnce()
  })

  it('still fires finally exactly once when the success callback throws', async () => {
    const error = new Error('success callback failed')
    const onSuccess = vi.fn(() => {
      throw error
    })
    const onFinally = vi.fn()

    await expect(runSaveOperation(async () => true, { onSuccess, onFinally })).rejects.toBe(error)

    expect(onSuccess).toHaveBeenCalledOnce()
    expect(onFinally).toHaveBeenCalledOnce()
  })
})
