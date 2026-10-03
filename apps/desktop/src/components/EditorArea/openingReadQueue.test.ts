import { describe, expect, it, vi } from 'vitest'
import { OpeningReadQueue } from './openingReadQueue'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

describe('opening read scheduling', () => {
  it('reserves capacity for a user open and promotes a queued background document', async () => {
    const queue = new OpeningReadQueue<string>()
    const a = deferred<string>()
    const b = deferred<string>()
    const running = [
      queue.read('a', () => a.promise, { priority: 'background' }),
      queue.read('b', () => b.promise, { priority: 'background' }),
    ]
    const background = vi.fn(async () => 'c')
    const pending = queue.read('c', background, { priority: 'background' })
    expect(background).not.toHaveBeenCalled()
    const opened = queue.read('c', vi.fn(), { priority: 'foreground' })
    expect(opened).toBe(pending)
    expect(background).toHaveBeenCalledOnce()
    await expect(opened).resolves.toBe('c')
    a.resolve('a')
    b.resolve('b')
    await Promise.all(running)
  })

  it('puts a new foreground request ahead of queued visible reads', async () => {
    const queue = new OpeningReadQueue<string>()
    const gate = deferred<string>()
    const reads = ['a', 'b', 'c'].map((key) => queue.read(key, () => gate.promise))
    const order: string[] = []
    reads.push(queue.read('visible', async () => { order.push('visible'); return '' }, { priority: 'visible' }))
    reads.push(queue.read('foreground', async () => { order.push('foreground'); return '' }))
    gate.resolve('')
    await Promise.all(reads)
    expect(order).toEqual(['foreground', 'visible'])
  })

  it('cancels one consumer without interrupting its sibling', async () => {
    const queue = new OpeningReadQueue<string>()
    const gate = deferred<string>()
    const controller = new AbortController()
    const read = vi.fn(() => gate.promise)
    const first = queue.read('shared', read, { signal: controller.signal })
    const sibling = queue.read('shared', read)
    controller.abort()
    await expect(first).rejects.toMatchObject({ name: 'AbortError' })
    gate.resolve('content')
    await expect(sibling).resolves.toBe('content')
    expect(read).toHaveBeenCalledOnce()
  })

  it('drops canceled queued work and does not reuse an abandoned in-flight read', async () => {
    const queue = new OpeningReadQueue<string>()
    const gate = deferred<string>()
    const reads = ['a', 'b', 'c'].map((key) => queue.read(key, () => gate.promise))
    const controller = new AbortController()
    const read = vi.fn(async () => 'old')
    const canceled = queue.read('closed', read, { signal: controller.signal })
    controller.abort()
    await expect(canceled).rejects.toMatchObject({ name: 'AbortError' })
    gate.resolve('')
    await Promise.all(reads)
    expect(read).not.toHaveBeenCalled()

    const stale = deferred<string>()
    const pendingController = new AbortController()
    const abandoned = queue.read('reopen', () => stale.promise, { signal: pendingController.signal })
    pendingController.abort()
    await expect(abandoned).rejects.toMatchObject({ name: 'AbortError' })
    await expect(queue.read('reopen', async () => 'new')).resolves.toBe('new')
    stale.resolve('old')
  })

  it('keeps workspace generations separate and never retains a settled read', async () => {
    const queue = new OpeningReadQueue<string>()
    const gate = deferred<string>()
    const oldScope = {}
    const old = queue.read('path', () => gate.promise, { scope: oldScope })
    await expect(queue.read('path', async () => 'new', { scope: {} })).resolves.toBe('new')
    gate.resolve('old')
    await old
    await expect(queue.read('path', async () => 'changed', { scope: oldScope })).resolves.toBe('changed')
  })
})
