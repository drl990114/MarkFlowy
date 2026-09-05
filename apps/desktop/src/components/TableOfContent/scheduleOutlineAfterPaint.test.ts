import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { scheduleOutlineAfterPaint } from './scheduleOutlineAfterPaint'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('deferred initial outline scheduling', () => {
  it('waits for two animation frames and then an idle callback', () => {
    const idle = vi.fn(() => 5)
    vi.stubGlobal('requestIdleCallback', idle)
    const callback = vi.fn()
    scheduleOutlineAfterPaint(callback)
    vi.advanceTimersToNextFrame()
    expect(idle).not.toHaveBeenCalled()
    vi.advanceTimersToNextFrame()
    expect(idle).toHaveBeenCalledWith(expect.any(Function), { timeout: 500 })
    expect(callback).not.toHaveBeenCalled()
    const run = idle.mock.calls[0] as unknown as [() => void]
    run[0]()
    expect(callback).toHaveBeenCalledOnce()
  })

  it('uses a delayed post-paint timer when WebKit has no idle callback', () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const callback = vi.fn()
    scheduleOutlineAfterPaint(callback)
    vi.advanceTimersToNextFrame()
    vi.advanceTimersToNextFrame()
    vi.advanceTimersByTime(119)
    expect(callback).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledOnce()
  })

  it.each([0, 1, 2])('cancels work after %s frames, including stale callbacks', (frames) => {
    let runIdle: (() => void) | undefined
    vi.stubGlobal('requestIdleCallback', (callback: () => void) => {
      runIdle = callback
      return 7
    })
    const cancelIdle = vi.fn()
    vi.stubGlobal('cancelIdleCallback', cancelIdle)
    const callback = vi.fn()
    const cancel = scheduleOutlineAfterPaint(callback)
    for (let frame = 0; frame < frames; frame++) vi.advanceTimersToNextFrame()
    cancel()
    vi.runAllTimers()
    runIdle?.()
    expect(callback).not.toHaveBeenCalled()
    if (frames === 2) expect(cancelIdle).toHaveBeenCalledWith(7)
  })

  it('clears the WebKit fallback when its owner unmounts', () => {
    vi.stubGlobal('requestIdleCallback', undefined)
    const callback = vi.fn()
    const cancel = scheduleOutlineAfterPaint(callback)
    vi.advanceTimersToNextFrame()
    vi.advanceTimersToNextFrame()
    cancel()
    vi.runAllTimers()
    expect(callback).not.toHaveBeenCalled()
  })
})
