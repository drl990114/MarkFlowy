import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeferredLatestPublisher } from './deferredLatestPublisher'

afterEach(() => {
  vi.useRealTimers()
})

describe('createDeferredLatestPublisher', () => {
  it('publishes only the latest scheduled value', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, {
      wait: 50,
      maxWait: 250,
    })

    publisher.schedule('first')
    publisher.schedule('latest')
    vi.advanceTimersByTime(50)

    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledWith('latest')
  })

  it('flushes synchronously and only once', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, {
      wait: 50,
      maxWait: 250,
    })

    publisher.schedule('pending')
    expect(publisher.hasPending()).toBe(true)
    publisher.flush()
    publisher.flush()
    vi.runAllTimers()

    expect(publisher.hasPending()).toBe(false)
    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledWith('pending')
  })

  it('cancels a pending publication', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, {
      wait: 50,
      maxWait: 250,
    })

    publisher.schedule('pending')
    publisher.cancel()
    vi.runAllTimers()

    expect(publisher.hasPending()).toBe(false)
    expect(publish).not.toHaveBeenCalled()
  })

  it('keeps the latest value pending when publication fails', () => {
    vi.useFakeTimers()
    const publish = vi.fn().mockReturnValueOnce(false)
    const publisher = createDeferredLatestPublisher(publish, {
      wait: 50,
      maxWait: 250,
    })

    publisher.schedule('latest')

    expect(publisher.flush()).toBe(false)
    expect(publisher.hasPending()).toBe(true)

    expect(publisher.flush()).toBe(true)

    expect(publisher.hasPending()).toBe(false)
    expect(publish).toHaveBeenCalledTimes(2)
    expect(publish).toHaveBeenLastCalledWith('latest')
  })

  it('publishes during continuous scheduling no later than maxWait', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, {
      wait: 50,
      maxWait: 250,
    })

    for (let elapsed = 0; elapsed < 250; elapsed += 40) {
      publisher.schedule(elapsed)
      vi.advanceTimersByTime(40)
    }

    expect(publish).toHaveBeenCalledTimes(1)
    expect(publish).toHaveBeenCalledWith(240)
  })
})
