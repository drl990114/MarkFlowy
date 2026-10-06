import { describe, expect, it, vi } from 'vitest'
import { createOpenedUrlQueue } from './openedUrlQueue'

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve
  })
  return { promise, resolve }
}

describe('opened URL queue', () => {
  it('serializes batches, deduplicates in-flight paths, and drains late arrivals', async () => {
    const firstBatch = deferred()
    const handled: string[][] = []
    const handler = vi.fn(async (urls: string[]) => {
      handled.push(urls)
      if (handled.length === 1) await firstBatch.promise
    })
    const queue = createOpenedUrlQueue(handler)

    const first = queue.enqueue(['file:///A.md'])
    const duplicate = queue.enqueue(['file:///A.md'])
    const second = queue.enqueue(['file:///B.md'])
    const drained = queue.drain()

    await Promise.resolve()
    expect(handled).toEqual([['file:///A.md']])

    firstBatch.resolve()
    await Promise.all([first, duplicate, second, drained])

    expect(handled).toEqual([['file:///A.md'], ['file:///B.md']])
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('keeps bootstrap ownership when a runtime event repeats the in-flight path', async () => {
    const bootstrap = deferred()
    const handler = vi.fn(async () => bootstrap.promise)
    const queue = createOpenedUrlQueue(handler)

    const first = queue.enqueue(['file:///bootstrap.md', 'file:///bootstrap.md'], 'current')
    const duplicate = queue.enqueue(['file:///bootstrap.md'], 'preference')
    await Promise.resolve()

    expect(handler.mock.calls).toEqual([[['file:///bootstrap.md'], 'current']])

    bootstrap.resolve()
    await Promise.all([first, duplicate])
    await queue.enqueue(['file:///bootstrap.md'])

    expect(handler.mock.calls).toEqual([
      [['file:///bootstrap.md'], 'current'],
      [['file:///bootstrap.md'], 'preference'],
    ])
  })

  it('preserves the target of distinct batches queued during bootstrap', async () => {
    const bootstrap = deferred()
    const handler = vi.fn(async (urls: string[]) => {
      if (urls.includes('file:///bootstrap.md')) await bootstrap.promise
    })
    const queue = createOpenedUrlQueue(handler)

    const first = queue.enqueue(['file:///bootstrap.md'], 'current')
    const runtime = queue.enqueue(['file:///bootstrap.md', 'file:///runtime.md'])
    bootstrap.resolve()
    await Promise.all([first, runtime, queue.drain()])

    expect(handler.mock.calls).toEqual([
      [['file:///bootstrap.md'], 'current'],
      [['file:///runtime.md'], 'preference'],
    ])
  })

  it('releases failed paths and lets later runtime batches proceed', async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error('window unavailable')).mockResolvedValue(undefined)
    const queue = createOpenedUrlQueue(handler)

    await expect(queue.enqueue(['file:///notes.md'], 'current')).rejects.toThrow('window unavailable')
    await queue.enqueue(['file:///notes.md'])
    await queue.drain()

    expect(handler.mock.calls).toEqual([
      [['file:///notes.md'], 'current'],
      [['file:///notes.md'], 'preference'],
    ])
  })
})
