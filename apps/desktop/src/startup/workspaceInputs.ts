/** Read-only startup work can overlap settings without publishing workspace state. */
export function createWorkspaceInputReader<T>(read: () => Promise<T>) {
  const attempts = new WeakMap<AbortSignal, Promise<T>>()
  return (signal: AbortSignal): Promise<T> => {
    let pending = attempts.get(signal)
    if (!pending) {
      pending = Promise.resolve().then(() => {
        signal.throwIfAborted()
        return read()
      })
      attempts.set(signal, pending)
      // Shell failure/cancellation may mean nobody consumes these independent reads.
      // The original promise still rejects when the workspace actually awaits it.
      void pending.catch(() => undefined)
    }
    return pending
  }
}
