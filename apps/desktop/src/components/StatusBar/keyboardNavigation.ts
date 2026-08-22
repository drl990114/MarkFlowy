import type { KeyboardEvent } from 'react'

export function handleStatusBarKeyDown(event: KeyboardEvent<HTMLElement>) {
  if (
    (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.shiftKey
  ) {
    return
  }

  const buttons = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[data-mf-status-bar-button]:not(:disabled)',
    ),
  )
  const activeIndex = buttons.findIndex((button) => button === document.activeElement)
  if (activeIndex < 0 || buttons.length < 2) return

  event.preventDefault()
  const direction = event.key === 'ArrowRight' ? 1 : -1
  const nextIndex = activeIndex + direction
  if (nextIndex < 0 || nextIndex >= buttons.length) return

  buttons[nextIndex]?.focus()
}
