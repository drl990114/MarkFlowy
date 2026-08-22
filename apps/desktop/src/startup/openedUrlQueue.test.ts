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
})
