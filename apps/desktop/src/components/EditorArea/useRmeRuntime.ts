import { useCallback, useEffect, useRef, useState } from 'react'
import { getLoadedRmeRuntime, loadRmeRuntime } from './rmeRuntime'

export function useRmeRuntime(required: boolean) {
  const [runtime, setRuntime] = useState(getLoadedRmeRuntime)
  const [error, setError] = useState<Error>()
  const [attempt, setAttempt] = useState(0)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Mode switches can prepare the engine while the current editor stays mounted.
  // Failures belong to the requesting interaction; initial opens use error/retry below.
  const prepare = useCallback(async () => {
    const loaded = await loadRmeRuntime()
    if (mounted.current) {
      setError(undefined)
      setRuntime(loaded)
    }
    return loaded
  }, [])
  useEffect(() => {
    if (!required || runtime) return
    let canceled = false
    setError(undefined)
    void loadRmeRuntime().then(
      (loaded) => {
        if (!canceled) {
          setError(undefined)
          setRuntime(loaded)
        }
      },
      (reason: unknown) => {
        if (!canceled) setError(reason instanceof Error ? reason : new Error(String(reason)))
      },
    )
    return () => {
      canceled = true
    }
  }, [attempt, required, runtime])

  const retry = useCallback(() => {
    setError(undefined)
    setAttempt((value) => value + 1)
  }, [])
  return { runtime, error: required ? error : undefined, retry, prepare }
}
