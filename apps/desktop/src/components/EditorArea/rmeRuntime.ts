import type * as Rme from 'rme'

export type RmeRuntime = typeof Rme

let runtime: RmeRuntime | undefined
let pending: Promise<RmeRuntime> | undefined

export function getLoadedRmeRuntime(): RmeRuntime | undefined {
  return runtime
}

/** Share the engine across source editors, source outlines and print jobs. */
export function loadRmeRuntime(): Promise<RmeRuntime> {
  if (runtime) return Promise.resolve(runtime)
  if (!pending) {
    pending = import('rme').then(
      (loaded) => {
        runtime = loaded
        return loaded
      },
      (error: unknown) => {
        pending = undefined
        throw error
      },
    )
  }
  return pending
}
