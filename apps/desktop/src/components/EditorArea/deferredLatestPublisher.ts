import { debounce } from 'lodash'

export interface DeferredLatestPublisher<T> {
  stage: (value: T) => void
  schedule: (value: T) => void
  flush: () => boolean
  cancel: () => void
  hasPending: () => boolean
  pause: () => void
  resume: () => void
}

export interface DeferredLatestPublisherOptions {
  wait: number
  maxWait: number
}

export function createDeferredLatestPublisher<T>(
  publish: (value: T) => boolean | void,
  options: DeferredLatestPublisherOptions | (() => DeferredLatestPublisherOptions),
): DeferredLatestPublisher<T> {
  let pendingValue: T | undefined
  let hasPendingValue = false
  let pendingVersion = 0
  let pendingSince: number | undefined

  const publishPendingValue = (): boolean => {
    if (!hasPendingValue) return true

    const value = pendingValue as T
    const version = pendingVersion
    if (publish(value) === false) return false
    if (pendingVersion === version) {
      pendingValue = undefined
      hasPendingValue = false
      pendingSince = undefined
    }
    return true
  }
  let timing: DeferredLatestPublisherOptions | undefined
  let deferredPublish: ReturnType<typeof debounce> | undefined
  const schedulePendingValue = () => {
    const configuredTiming = typeof options === 'function' ? options() : options
    // Native input stages cancel the timer while the Controller is pending, but
    // must not restart the maximum wait on every following commit. Shorten the
    // next debounce to the remaining deadline; wait=0 still publishes async.
    const elapsed = pendingSince === undefined ? 0 : Math.max(0, Date.now() - pendingSince)
    const remaining = Math.max(
      0,
      Math.max(configuredTiming.wait, configuredTiming.maxWait) - elapsed,
    )
    const nextTiming = {
      wait: Math.min(configuredTiming.wait, remaining),
      maxWait: remaining,
    }
    if (!timing || timing.wait !== nextTiming.wait || timing.maxWait !== nextTiming.maxWait) {
      deferredPublish?.cancel()
      timing = nextTiming
      deferredPublish = debounce(publishPendingValue, timing.wait, { maxWait: timing.maxWait })
    }
    // Lodash's maxWait=0 can invoke synchronously on a second same-tick call.
    // Restart that zero-delay timer so an expired deadline still yields first.
    if (remaining === 0) deferredPublish!.cancel()
    deferredPublish!()
  }
  const updatePendingValue = (value: T) => {
    if (!hasPendingValue) pendingSince = Date.now()
    pendingValue = value
    hasPendingValue = true
    pendingVersion += 1
  }

  return {
    stage(value) {
      updatePendingValue(value)
      deferredPublish?.cancel()
    },
    schedule(value) {
      updatePendingValue(value)
      schedulePendingValue()
    },
    flush() {
      if (!hasPendingValue) return true
      deferredPublish?.cancel()
      return publishPendingValue()
    },
    cancel() {
      deferredPublish?.cancel()
      pendingValue = undefined
      hasPendingValue = false
      pendingSince = undefined
    },
    hasPending() {
      return hasPendingValue
    },
    pause() {
      deferredPublish?.cancel()
    },
    resume() {
      if (hasPendingValue) schedulePendingValue()
    },
  }
}
