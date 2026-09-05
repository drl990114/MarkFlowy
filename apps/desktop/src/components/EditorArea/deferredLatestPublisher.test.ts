import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeferredLatestPublisher } from './deferredLatestPublisher'

afterEach(() => {
  vi.useRealTimers()
})

describe('createDeferredLatestPublisher', () => {
  it('adapts after asynchronous document loading without publishing a stale value', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    let timing = { wait: 50, maxWait: 250 }
    const publisher = createDeferredLatestPublisher(publish, () => timing)
    publisher.schedule('small')
    vi.advanceTimersByTime(20)
    timing = { wait: 250, maxWait: 1000 }
    publisher.schedule('loaded large document')
    vi.advanceTimersByTime(50)
    expect(publish).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(publish).toHaveBeenCalledExactlyOnceWith('loaded large document')
    timing = { wait: 50, maxWait: 250 }
    publisher.schedule('small again')
    vi.advanceTimersByTime(50)
    expect(publish).toHaveBeenLastCalledWith('small again')
    expect(publish).toHaveBeenCalledTimes(2)
  })

  it('keeps staged input pending without publishing until committed or explicitly flushed', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, { wait: 50, maxWait: 250 })
    publisher.schedule('older commit')
    publisher.stage('native input')
    vi.advanceTimersByTime(1000)
    expect(publish).not.toHaveBeenCalled()
    expect(publisher.hasPending()).toBe(true)

    publisher.stage('latest native input')
    expect(publisher.flush()).toBe(true)
    expect(publish).toHaveBeenCalledExactlyOnceWith('latest native input')
    expect(publisher.hasPending()).toBe(false)

    publisher.stage('next input')
    publisher.schedule('next commit')
    vi.advanceTimersByTime(50)
    expect(publish).toHaveBeenLastCalledWith('next commit')
    expect(publish).toHaveBeenCalledTimes(2)
  })

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

describe('native input publication deadlines', () => {
  it('retains maxWait across repeated native pending and commit pairs', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, { wait: 250, maxWait: 1000 })
    for (let index = 0; index < 20; index += 1) {
      publisher.stage(`pending ${index}`)
      publisher.schedule(`commit ${index}`)
      vi.advanceTimersByTime(100)
    }
    expect(publish.mock.calls).toEqual([['commit 9'], ['commit 19']])
    expect(publisher.hasPending()).toBe(false)
  })

  it('waits for a commit after a long pending period and publishes asynchronously', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, { wait: 250, maxWait: 1000 })
    publisher.stage('pending input')
    vi.advanceTimersByTime(1500)
    expect(publish).not.toHaveBeenCalled()
    publisher.schedule('committed input')
    publisher.schedule('latest committed input')
    expect(publish).not.toHaveBeenCalled()
    vi.runOnlyPendingTimers()
    expect(publish).toHaveBeenCalledExactlyOnceWith('latest committed input')
  })

  it('does not publish a pending replacement when an older commit reaches its deadline', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, { wait: 250, maxWait: 1000 })
    publisher.schedule('old commit')
    vi.advanceTimersByTime(100)
    publisher.stage('pending replacement')
    vi.advanceTimersByTime(1000)
    expect(publish).not.toHaveBeenCalled()
    publisher.schedule('replacement commit')
    expect(publish).not.toHaveBeenCalled()
    vi.runOnlyPendingTimers()
    expect(publish).toHaveBeenCalledExactlyOnceWith('replacement commit')
  })

  it('preserves small-document trailing waits and starts a fresh deadline after cancel', () => {
    vi.useFakeTimers()
    const publish = vi.fn()
    const publisher = createDeferredLatestPublisher(publish, { wait: 50, maxWait: 250 })
    publisher.stage('pending')
    publisher.schedule('small commit')
    vi.advanceTimersByTime(49)
    expect(publish).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(publish).toHaveBeenCalledExactlyOnceWith('small commit')
    publisher.stage('canceled')
    vi.advanceTimersByTime(1000)
    publisher.cancel()
    publisher.schedule('fresh commit')
    vi.advanceTimersByTime(49)
    expect(publish).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(1)
    expect(publish).toHaveBeenLastCalledWith('fresh commit')
  })

  it('does not discard a newer staged value when publishing reenters the host', () => {
    vi.useFakeTimers()
    const publish = vi.fn((value: string) => {
      if (value === 'first') publisher.stage('new pending')
    })
    const publisher = createDeferredLatestPublisher(publish, { wait: 50, maxWait: 250 })
    publisher.schedule('first')
    vi.advanceTimersByTime(50)
    expect(publisher.hasPending()).toBe(true)
    vi.advanceTimersByTime(1000)
    expect(publish).toHaveBeenCalledExactlyOnceWith('first')
    publisher.schedule('new commit')
    expect(publish).toHaveBeenCalledOnce()
    vi.runOnlyPendingTimers()
    expect(publish).toHaveBeenLastCalledWith('new commit')
    expect(publisher.hasPending()).toBe(false)
  })
})
