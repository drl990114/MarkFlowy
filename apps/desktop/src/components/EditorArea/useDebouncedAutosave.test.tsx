import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedAutosave } from './useDebouncedAutosave'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useDebouncedAutosave', () => {
  it('reschedules a dirty document when its interval changes or autosave is enabled', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue(true)
    const { rerender } = renderHook(
      ({ wait, enabled }) =>
        useDebouncedAutosave(save, {
          active: true,
          flushOnDeactivate: true,
          dirty: true,
          wait,
          enabled,
        }),
      { initialProps: { wait: 5000, enabled: true } },
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    rerender({ wait: 1000, enabled: true })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(save).toHaveBeenCalledOnce()
    rerender({ wait: 1000, enabled: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000)
    })
    expect(save).toHaveBeenCalledOnce()
    rerender({ wait: 1000, enabled: true })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(save).toHaveBeenCalledTimes(2)
  })
  it('saves within maxWait during continuous input', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue(true)
    const { result } = renderHook(() =>
      useDebouncedAutosave(save, {
        active: true,
        flushOnDeactivate: true,
        wait: 2000,
        enabled: true,
      }),
    )
    for (let n = 0; n < 25; n++) {
      act(() => {
        result.current()
      })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500)
      })
    }
    expect(save).toHaveBeenCalledOnce()
  })

  it('cancels the scheduled write when autosave is disabled', async () => {
    vi.useFakeTimers()
    const save = vi.fn().mockResolvedValue(true)
    const { result, rerender } = renderHook(
      ({ enabled }) =>
        useDebouncedAutosave(save, { active: true, flushOnDeactivate: true, wait: 2000, enabled }),
      { initialProps: { enabled: true } },
    )
    act(() => {
      result.current()
    })
    rerender({ enabled: false })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20000)
    })
    expect(save).not.toHaveBeenCalled()
  })
  it('flushes a pending save with the latest callback when the editor deactivates', async () => {
    vi.useFakeTimers()
    const activeSave = vi.fn().mockResolvedValue(true)
    const inactiveSave = vi.fn().mockResolvedValue(true)
    const { result, rerender } = renderHook(
      ({ active, save }) =>
        useDebouncedAutosave(save, { active, flushOnDeactivate: true, wait: 1000 }),
      { initialProps: { active: true, save: activeSave } },
    )

    act(() => {
      result.current()
    })
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

    act(() => {
      result.current()
    })
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

    act(() => {
      result.current()
    })
    unmount()
    await vi.runAllTimersAsync()

    expect(save).not.toHaveBeenCalled()
  })
})
