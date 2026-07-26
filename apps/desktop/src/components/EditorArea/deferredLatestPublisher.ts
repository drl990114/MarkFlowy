import { debounce } from 'lodash'

export interface DeferredLatestPublisher<T> {
  schedule: (value: T) => void
  flush: () => boolean
  cancel: () => void
  hasPending: () => boolean
}

export interface DeferredLatestPublisherOptions {
  wait: number
  maxWait: number
}

export function createDeferredLatestPublisher<T>(
  publish: (value: T) => boolean | void,
  options: DeferredLatestPublisherOptions,
): DeferredLatestPublisher<T> {
  let pendingValue: T | undefined
  let hasPendingValue = false
  let pendingVersion = 0

  const publishPendingValue = (): boolean => {
    if (!hasPendingValue) return true

    const value = pendingValue as T
    const version = pendingVersion
    if (publish(value) === false) return false
    if (pendingVersion === version) {
      pendingValue = undefined
      hasPendingValue = false
    }
    return true
  }
  const deferredPublish = debounce(publishPendingValue, options.wait, {
    maxWait: options.maxWait,
  })

  return {
    schedule(value) {
      pendingValue = value
      hasPendingValue = true
      pendingVersion += 1
      deferredPublish()
    },
    flush() {
      if (!hasPendingValue) return true
      deferredPublish.cancel()
      return publishPendingValue()
    },
    cancel() {
      deferredPublish.cancel()
      pendingValue = undefined
      hasPendingValue = false
    },
    hasPending() {
      return hasPendingValue
    },
  }
}
