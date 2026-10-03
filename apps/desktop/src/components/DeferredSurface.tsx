import { useEffect, useState, type ReactNode } from 'react'
import { AsyncSurface, type AsyncSurfaceState } from './AsyncSurface'

/** Mount inside the already-open dialog so focus capture precedes module I/O. */
export function DeferredSurface<T>({
  load,
  children,
  loadingLabel,
  errorTitle,
  retryLabel,
}: {
  load: () => Promise<T>
  children: (module: T) => ReactNode
  loadingLabel: ReactNode
  errorTitle: ReactNode
  retryLabel: string
}) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<AsyncSurfaceState<T>>({ status: 'loading' })
  useEffect(() => {
    let disposed = false
    setState({ status: 'loading', label: loadingLabel })
    void Promise.resolve().then(load).then(
      (data) => {
        if (!disposed) setState({ status: 'ready', data })
      },
      (error: unknown) => {
        if (!disposed) {
          setState({
            status: 'error',
            title: errorTitle,
            description: error instanceof Error ? error.message : String(error),
            retry: () => setAttempt((value) => value + 1),
          })
        }
      },
    )
    return () => {
      disposed = true
    }
  }, [attempt, errorTitle, load, loadingLabel])
  return <AsyncSurface state={state} retryLabel={retryLabel}>{children}</AsyncSurface>
}
