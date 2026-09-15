import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { t } from '@/i18n'
import './editor-loading.css'

export const EDITOR_LOADING_DELAY_MS = 800

// Used only during the initial lazy-module handoff. New tabs start their own clocks.
export const EditorOpeningClockContext = createContext<{ startedAt: number | null } | null>(null)

/** One timer for the whole opening operation, independent of its internal stages. */
export function EditorLoadingProgress({
  pending,
  visible = true,
}: {
  pending: boolean
  visible?: boolean
}) {
  const clock = useContext(EditorOpeningClockContext)
  const startedAtRef = useRef(clock?.startedAt ?? null)
  const [elapsed, setElapsed] = useState(
    () =>
      startedAtRef.current !== null &&
      performance.now() - startedAtRef.current >= EDITOR_LOADING_DELAY_MS,
  )
  useEffect(() => {
    if (!pending || !visible) {
      startedAtRef.current = null
      setElapsed(false)
      return
    }
    startedAtRef.current ??= performance.now()
    const delay = Math.max(0, EDITOR_LOADING_DELAY_MS - (performance.now() - startedAtRef.current))
    setElapsed(delay === 0)
    if (delay === 0) return
    const timer = setTimeout(() => setElapsed(true), delay)
    return () => clearTimeout(timer)
  }, [pending, visible])

  if (!pending || !visible || !elapsed) return null
  return (
    <div
      className='mf-editor-loading-progress'
      data-slot='editor-loading-progress'
      role='progressbar'
      aria-label={t('common.fetching')}
    >
      <div className='mf-editor-loading-indicator bg-primary' />
    </div>
  )
}
