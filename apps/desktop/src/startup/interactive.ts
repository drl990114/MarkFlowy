import { markStartupStage } from './performance'

export type StartupInteractiveOutcome = 'editable' | 'empty' | 'preview' | 'error'

export function createInteractiveGate() {
  let outcome: StartupInteractiveOutcome | undefined
  const listeners = new Set<() => void>()
  return {
    getOutcome: () => outcome,
    settle(value: StartupInteractiveOutcome) {
      if (outcome) return false
      outcome = value
      for (const listener of listeners) listener()
      listeners.clear()
      return true
    },
    subscribe(listener: () => void) {
      if (outcome) listener()
      else listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export const startupInteractive = createInteractiveGate()

export const waitForStartupInteractive = () => new Promise<void>((resolve) => {
  startupInteractive.subscribe(resolve)
})

export function markStartupInteractive(outcome: StartupInteractiveOutcome) {
  if (startupInteractive.settle(outcome)) markStartupStage(`interactive-${outcome}`)
}

/** Error/empty windows also release background work, without claiming an editable document. */
export function afterStartupInteractive(
  task: () => void,
  {
    signal,
    timeout = 2_000,
    targetWindow = window,
    gate = startupInteractive,
  }: {
    signal?: AbortSignal
    timeout?: number
    targetWindow?: Window
    gate?: ReturnType<typeof createInteractiveGate>
  } = {},
) {
  let canceled = false
  let frame: number | undefined
  let idle: number | undefined
  let timer: number | undefined
  const run = () => { if (!canceled && !signal?.aborted) task() }
  const unsubscribe = gate.subscribe(() => {
    if (canceled || signal?.aborted) return
    // Leave a paint opportunity before any background JavaScript is evaluated.
    frame = targetWindow.requestAnimationFrame(() => {
      frame = targetWindow.requestAnimationFrame(() => {
        if (typeof targetWindow.requestIdleCallback === 'function') {
          idle = targetWindow.requestIdleCallback(run, { timeout })
        } else {
          timer = targetWindow.setTimeout(run, 16)
        }
      })
    })
  })
  const cancel = () => {
    canceled = true
    unsubscribe()
    if (frame !== undefined) targetWindow.cancelAnimationFrame(frame)
    if (idle !== undefined) targetWindow.cancelIdleCallback?.(idle)
    if (timer !== undefined) targetWindow.clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
  signal?.addEventListener('abort', cancel, { once: true })
  return cancel
}
