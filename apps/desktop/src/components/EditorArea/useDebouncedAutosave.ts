import { debounce, type DebouncedFunc } from 'lodash'
import { useEffect, useMemo, useRef } from 'react'

type Save = () => Promise<boolean>

interface UseDebouncedAutosaveOptions {
  active: boolean
  flushOnDeactivate: boolean
  wait: number
}

/**
 * Keeps an autosave timer alive when the surrounding editor props change while
 * always invoking the latest save implementation. A pending save is flushed
 * when its editor loses active status, so switching tabs cannot cancel it.
 */
export function useDebouncedAutosave(
  save: Save,
  options: UseDebouncedAutosaveOptions,
): DebouncedFunc<Save> {
  const saveRef = useRef(save)
  const wasActiveRef = useRef(options.active)

  useEffect(() => {
    saveRef.current = save
  }, [save])

  const debouncedSave = useMemo(
    () => debounce(() => saveRef.current(), options.wait),
    [options.wait],
  )

  useEffect(() => () => debouncedSave.cancel(), [debouncedSave])

  useEffect(() => {
    const wasActive = wasActiveRef.current
    wasActiveRef.current = options.active

    if (wasActive && !options.active && options.flushOnDeactivate) {
      void debouncedSave.flush()
    }
  }, [debouncedSave, options.active, options.flushOnDeactivate])

  return debouncedSave
}
