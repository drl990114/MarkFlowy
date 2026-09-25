import { getCapricornRuntimeInput, hasVisibleFailedSourceEditor, hasVisiblePendingSourceEditor } from '@/components/EditorArea/capricornRuntimeDom'
import { markStartupInteractive, startupInteractive } from './interactive'

/** Scheduling readiness is independent of opt-in performance diagnostics. */
export function observeStartupEditable(
  container: HTMLElement,
  isCurrent: () => boolean,
  onReady?: () => void,
  allowEmpty = false,
) {
  if (startupInteractive.getOutcome()) return () => {}
  let frame: number
  let confirmed = false
  let canceled = false
  const check = () => {
    if (canceled || startupInteractive.getOutcome() || !isCurrent() || !container.isConnected) return
    if (hasVisibleFailedSourceEditor(container)) {
      markStartupInteractive('error')
      return
    }
    const richContent = container.querySelector<HTMLElement>('[data-cap-content]')
    const content = richContent ?? container.querySelector<HTMLElement>('.cm-content')
    const input = richContent ? getCapricornRuntimeInput(container) : content
    const bounds = content?.getBoundingClientRect()
    const hasDocument = !richContent || (
      (allowEmpty || richContent.textContent?.replace(/[\s\u200b\ufeff]/g, '') ||
        richContent.querySelector('img, hr, table, [data-markdown-block]')) &&
      richContent.querySelector('[data-cap-leaf], img, hr, table, [data-markdown-block]')
    )
    const valid = Boolean(
      hasDocument && content && input && bounds && bounds.width > 0 && bounds.height > 0 &&
      getComputedStyle(content).visibility !== 'hidden' &&
      document.visibilityState !== 'hidden' && !hasVisiblePendingSourceEditor(container) &&
      !('disabled' in input && input.disabled),
    )
    if (valid && confirmed) {
      const readOnly = richContent
        ? input && 'readOnly' in input && input.readOnly
        : content?.getAttribute('contenteditable') !== 'true'
      onReady?.()
      markStartupInteractive(readOnly ? 'preview' : 'editable')
      return
    }
    confirmed = valid
    frame = window.requestAnimationFrame(check)
  }
  frame = window.requestAnimationFrame(check)
  return () => {
    canceled = true
    window.cancelAnimationFrame(frame)
  }
}
