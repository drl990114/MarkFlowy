import type {
  CapricornDocumentStatistics,
  CapricornRuntimeAdapter,
} from './capricornRuntimeAdapter'

type StatisticsEditor = Pick<CapricornRuntimeAdapter, 'getStatistics'>

interface CapricornStatisticsSchedulerOptions {
  cancelAnimationFrame?: (handle: number) => void
  cancelIdle?: (handle: number) => void
  onError?: (error: unknown) => void
  requestAnimationFrame?: (callback: FrameRequestCallback) => number
  requestIdle?: (callback: () => void) => number
}

export interface CapricornStatisticsScheduler {
  cancel: () => void
  schedule: (editor: StatisticsEditor | null | undefined) => boolean
}

function defaultRequestIdle(callback: () => void): number {
  if (typeof window.requestIdleCallback === 'function') {
    return window.requestIdleCallback(callback, { timeout: 1_000 }) as unknown as number
  }
  return window.setTimeout(callback, 0)
}

function defaultCancelIdle(handle: number): void {
  if (typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(handle)
    return
  }
  window.clearTimeout(handle)
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

/**
 * Runs optional Capricorn statistics only after two paint opportunities and an
 * idle opportunity. Replacing, hiding or destroying an editor invalidates the
 * old result and aborts a runtime computation that supports AbortSignal.
 */
export function createCapricornStatisticsScheduler(
  onStatistics: (statistics: CapricornDocumentStatistics) => void,
  options: CapricornStatisticsSchedulerOptions = {},
): CapricornStatisticsScheduler {
  const requestFrame = options.requestAnimationFrame ?? window.requestAnimationFrame.bind(window)
  const cancelFrame = options.cancelAnimationFrame ?? window.cancelAnimationFrame.bind(window)
  const requestIdle = options.requestIdle ?? defaultRequestIdle
  const cancelIdle = options.cancelIdle ?? defaultCancelIdle
  let generation = 0
  let firstFrame: number | undefined
  let secondFrame: number | undefined
  let idleHandle: number | undefined
  let abortController: AbortController | undefined

  const cancel = () => {
    generation += 1
    if (firstFrame !== undefined) cancelFrame(firstFrame)
    if (secondFrame !== undefined) cancelFrame(secondFrame)
    if (idleHandle !== undefined) cancelIdle(idleHandle)
    abortController?.abort()
    firstFrame = undefined
    secondFrame = undefined
    idleHandle = undefined
    abortController = undefined
  }

  const schedule = (editor: StatisticsEditor | null | undefined) => {
    cancel()
    const getStatistics = editor?.getStatistics
    if (!getStatistics) return false

    const currentGeneration = generation
    firstFrame = requestFrame(() => {
      firstFrame = undefined
      secondFrame = requestFrame(() => {
        secondFrame = undefined
        idleHandle = requestIdle(() => {
          idleHandle = undefined
          if (generation !== currentGeneration) return

          const currentAbortController = new AbortController()
          abortController = currentAbortController
          Promise.resolve()
            .then(() => getStatistics.call(editor, { signal: currentAbortController.signal }))
            .then((statistics) => {
              if (generation === currentGeneration && !currentAbortController.signal.aborted) {
                onStatistics(statistics)
              }
            })
            .catch((error: unknown) => {
              if (
                generation === currentGeneration &&
                !currentAbortController.signal.aborted &&
                !isAbortError(error)
              ) {
                options.onError?.(error)
              }
            })
            .finally(() => {
              if (abortController === currentAbortController) abortController = undefined
            })
        })
      })
    })
    return true
  }

  return { cancel, schedule }
}
