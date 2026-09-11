import { getCapricornEditor, subscribeCapricornEditors } from './capricornEditorRegistry'

let generation = 0
let cancelPending: (() => void) | undefined

/** Every navigation, including one without a fragment, cancels stale work. */
export function beginLinkNavigation() {
  generation += 1
  cancelPending?.()
  cancelPending = undefined
  return generation
}

export function isCurrentLinkNavigation(request: number) {
  return request === generation
}

export function navigateLinkFragment(
  fileId: string,
  fragment: string,
  request = beginLinkNavigation(),
): Promise<boolean> {
  if (request !== generation) return Promise.resolve(false)
  return new Promise((resolve) => {
    let done = false
    let running = false
    let unsubscribe = () => {}
    const finish = (result: boolean) => {
      if (done) return
      done = true
      unsubscribe()
      clearTimeout(timer)
      if (cancelPending === cancel) cancelPending = undefined
      resolve(result)
    }
    const cancel = () => finish(false)
    const attempt = async () => {
      if (done || running || request !== generation) return
      const runtime = getCapricornEditor(fileId)
      if (!runtime) return
      running = true
      try {
        // Optional for compatibility with the currently installed older runtime.
        const result = await runtime.headings.jumpToAnchor?.(fragment)
        if (getCapricornEditor(fileId) === runtime)
          finish(request === generation && result === true)
      } catch {
        if (getCapricornEditor(fileId) === runtime) finish(false)
      } finally {
        running = false
        if (!done) void attempt()
      }
    }
    const timer = setTimeout(() => finish(false), 10_000)
    cancelPending = cancel
    unsubscribe = subscribeCapricornEditors(() => {
      void attempt()
    })
    void attempt()
  })
}
