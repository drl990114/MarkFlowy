import { describe, expect, it, vi } from 'vitest'
import type {
  CapricornDocumentStatistics,
  CapricornRuntimeAdapter,
} from './capricornRuntimeAdapter'
import { createCapricornStatisticsScheduler } from './capricornStatisticsScheduler'

function createTimingHarness() {
  let sequence = 0
  const frames = new Map<number, FrameRequestCallback>()
  const idles = new Map<number, () => void>()
  return {
    cancelAnimationFrame: vi.fn((handle: number) => frames.delete(handle)),
    cancelIdle: vi.fn((handle: number) => idles.delete(handle)),
    requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
      const handle = ++sequence
      frames.set(handle, callback)
      return handle
    }),
    requestIdle: vi.fn((callback: () => void) => {
      const handle = ++sequence
      idles.set(handle, callback)
      return handle
    }),
    runNextFrame() {
      const entry = frames.entries().next().value as [number, FrameRequestCallback] | undefined
      expect(entry).toBeDefined()
      frames.delete(entry![0])
      entry![1](performance.now())
    },
    runNextIdle() {
      const entry = idles.entries().next().value as [number, () => void] | undefined
      expect(entry).toBeDefined()
      idles.delete(entry![0])
      entry![1]()
    },
    get pendingFrames() {
      return frames.size
    },
    get pendingIdles() {
      return idles.size
    },
  }
}

function createScheduler(
  onStatistics: Parameters<typeof createCapricornStatisticsScheduler>[0],
  timing: ReturnType<typeof createTimingHarness>,
  onError = vi.fn(),
) {
  return createCapricornStatisticsScheduler(onStatistics, {
    cancelAnimationFrame: timing.cancelAnimationFrame,
    cancelIdle: timing.cancelIdle,
    onError,
    requestAnimationFrame: timing.requestAnimationFrame,
    requestIdle: timing.requestIdle,
  })
}

describe('createCapricornStatisticsScheduler', () => {
  it('waits for two paints and an idle opportunity before requesting statistics', async () => {
    const timing = createTimingHarness()
    const onStatistics = vi.fn()
    const statistics = {
      characterCount: 10,
      nonWhitespaceCharacterCount: 8,
      wordCount: 2,
    }
    const getStatistics = vi.fn(async (options?: { signal?: AbortSignal }) => {
      void options
      return statistics
    })
    const scheduler = createScheduler(onStatistics, timing)

    expect(scheduler.schedule({ getStatistics })).toBe(true)
    expect(getStatistics).not.toHaveBeenCalled()
    timing.runNextFrame()
    expect(getStatistics).not.toHaveBeenCalled()
    timing.runNextFrame()
    expect(timing.pendingIdles).toBe(1)
    expect(getStatistics).not.toHaveBeenCalled()
    timing.runNextIdle()
    await vi.waitFor(() => expect(getStatistics).toHaveBeenCalledOnce())
    expect(getStatistics.mock.calls[0][0]?.signal).toBeInstanceOf(AbortSignal)
    await vi.waitFor(() => expect(onStatistics).toHaveBeenCalledWith(statistics))
  })

  it('cancels work before it reaches the runtime and never falls back to export', () => {
    const timing = createTimingHarness()
    const onStatistics = vi.fn()
    const editor = {
      export: vi.fn(),
      getStatistics: vi.fn(),
    } as unknown as Pick<CapricornRuntimeAdapter, 'getStatistics'> & {
      export: ReturnType<typeof vi.fn>
    }
    const scheduler = createScheduler(onStatistics, timing)

    scheduler.schedule(editor)
    scheduler.cancel()

    expect(timing.pendingFrames).toBe(0)
    expect(editor.getStatistics).not.toHaveBeenCalled()
    expect(editor.export).not.toHaveBeenCalled()
    expect(onStatistics).not.toHaveBeenCalled()
  })

  it('aborts an obsolete request and ignores its late result', async () => {
    const timing = createTimingHarness()
    const onStatistics = vi.fn()
    let resolveFirst!: (value: CapricornDocumentStatistics) => void
    let firstSignal: AbortSignal | undefined
    const first = {
      getStatistics: vi.fn(({ signal }: { signal?: AbortSignal } = {}) => {
        firstSignal = signal
        return new Promise<CapricornDocumentStatistics>((resolve) => {
          resolveFirst = resolve
        })
      }),
    }
    const secondStatistics = {
      characterCount: 20,
      nonWhitespaceCharacterCount: 18,
      wordCount: 4,
    }
    const second = { getStatistics: vi.fn(async () => secondStatistics) }
    const scheduler = createScheduler(onStatistics, timing)

    scheduler.schedule(first)
    timing.runNextFrame()
    timing.runNextFrame()
    timing.runNextIdle()
    await Promise.resolve()
    expect(firstSignal?.aborted).toBe(false)

    scheduler.schedule(second)
    expect(firstSignal?.aborted).toBe(true)
    resolveFirst({ characterCount: 1, nonWhitespaceCharacterCount: 1, wordCount: 1 })
    await Promise.resolve()
    await Promise.resolve()
    expect(onStatistics).not.toHaveBeenCalled()

    timing.runNextFrame()
    timing.runNextFrame()
    timing.runNextIdle()
    await vi.waitFor(() => expect(onStatistics).toHaveBeenCalledExactlyOnceWith(secondStatistics))
  })

  it('reports a current runtime failure but ignores a canceled one', async () => {
    const timing = createTimingHarness()
    const onError = vi.fn()
    const error = new Error('statistics failed')
    const scheduler = createScheduler(vi.fn(), timing, onError)
    const failing = { getStatistics: vi.fn(async () => Promise.reject(error)) }

    scheduler.schedule(failing)
    timing.runNextFrame()
    timing.runNextFrame()
    timing.runNextIdle()
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith(error))

    onError.mockClear()
    scheduler.schedule(failing)
    timing.runNextFrame()
    timing.runNextFrame()
    timing.runNextIdle()
    await Promise.resolve()
    scheduler.cancel()
    await Promise.resolve()
    await Promise.resolve()
    expect(onError).not.toHaveBeenCalled()
  })

  it('is a no-op when the pinned runtime has no statistics capability', () => {
    const timing = createTimingHarness()
    const scheduler = createScheduler(vi.fn(), timing)

    expect(scheduler.schedule({})).toBe(false)
    expect(timing.pendingFrames).toBe(0)
    expect(timing.pendingIdles).toBe(0)
  })
})
