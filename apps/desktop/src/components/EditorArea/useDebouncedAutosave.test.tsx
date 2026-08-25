import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedAutosave } from './useDebouncedAutosave'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useDebouncedAutosave', () => {
  it('flushes a pending save with the latest callback when the editor deactivates', async () => {
    vi.useFakeTimers()
    const activeSave = vi.fn().mockResolvedValue(true)
    const inactiveSave = vi.fn().mockResolvedValue(true)
    const { result, rerender } = renderHook(
      ({ active, save }) =>
        useDebouncedAutosave(save, { active, flushOnDeactivate: true, wait: 1000 }),
      { initialProps: { active: true, save: activeSave } },
    )

    act(() => result.current())
    await act(async () => {
      rerender({ active: false, save: inactiveSave })
    })

    expect(activeSave).not.toHaveBeenCalled()
    expect(inactiveSave).toHaveBeenCalledOnce()
  })

  it('keeps a pending save across callback changes while still active', async () => {
    vi.useFakeTimers()
    const initialSave = vi.fn().mockResolvedValue(true)
    const latestSave = vi.fn().mockResolvedValue(true)
    const { result, rerender } = renderHook(
      ({ save }) =>
        useDebouncedAutosave(save, { active: true, flushOnDeactivate: true, wait: 1000 }),
      { initialProps: { save: initialSave } },
    )

    act(() => result.current())
    rerender({ save: latestSave })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })

    expect(initialSave).not.toHaveBeenCalled()
    expect(latestSave).toHaveBeenCalledOnce()
  })

  it('cancels a pending save when the editor unmounts', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue(true)
    const { result, unmount } = renderHook(() =>
      useDebouncedAutosave(save, { active: true, flushOnDeactivate: true, wait: 1000 }),
    )

    act(() => result.current())
    unmount()
    await vi.runAllTimersAsync()

    expect(save).not.toHaveBeenCalled()
  })
})
