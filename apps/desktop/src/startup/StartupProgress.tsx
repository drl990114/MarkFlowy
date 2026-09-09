import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { syncStartupProgress } from './boot'

export function StartupProgress({ label }: { label: ReactNode }) {
  const indicatorRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (indicatorRef.current) syncStartupProgress(indicatorRef.current)
  }, [])

  return (
    <div
      aria-live='polite'
      className='mf-startup-progress flex min-h-24 flex-1 items-center justify-center'
      data-slot='startup-progress'
      role='status'
    >
      <div aria-hidden='true' className='mf-startup-indicator' ref={indicatorRef}>
        <div className='mf-boot-progress' />
        <span className='mf-startup-label'>{label}</span>
      </div>
      <span className='sr-only'>{label}</span>
    </div>
  )
}
