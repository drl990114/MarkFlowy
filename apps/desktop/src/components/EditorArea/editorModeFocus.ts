import { getCapricornRuntimeInput } from './capricornRuntimeDom'

/** Keep keyboard focus through a mode replacement, unless the user moves away. */
export function captureEditorModeFocus(container: HTMLElement) {
  const doc = container.ownerDocument
  const ownsFocus = (target: EventTarget | null) =>
    target instanceof Node &&
    (container.contains(target) || target === getCapricornRuntimeInput(container))
  if (!ownsFocus(doc.activeElement)) return undefined

  let pending = true
  const cancel = () => {
    pending = false
    doc.removeEventListener('focusin', onFocus, true)
    doc.removeEventListener('pointerdown', onInteraction, true)
    doc.removeEventListener('keydown', onInteraction, true)
    doc.defaultView?.removeEventListener('blur', cancel)
  }
  const onFocus = (event: FocusEvent) => {
    // Removing the old editor can leave focus on body without user interaction.
    if (event.target !== doc.body && !ownsFocus(event.target)) cancel()
  }
  const onInteraction = (event: Event) => {
    if (!ownsFocus(event.target)) cancel()
  }
  doc.addEventListener('focusin', onFocus, true)
  doc.addEventListener('pointerdown', onInteraction, true)
  doc.addEventListener('keydown', onInteraction, true)
  doc.defaultView?.addEventListener('blur', cancel)

  return {
    cancel,
    restore(focus: () => void) {
      const shouldFocus = pending && (doc.activeElement === doc.body || ownsFocus(doc.activeElement))
      cancel()
      if (shouldFocus) focus()
    },
  }
}
