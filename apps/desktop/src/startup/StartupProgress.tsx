import type { ReactNode } from 'react'

export function StartupProgress({ label }: { label: ReactNode }) {
  return (
    <div
      aria-live='polite'
      className='mf-startup-progress flex min-h-24 flex-1 items-center justify-center'
      data-slot='startup-progress'
      role='status'
    >
      <div aria-hidden='true' className='mf-boot-progress' />
      <span className='sr-only'>{label}</span>
    </div>
  )
}
