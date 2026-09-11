import { createKeybindingsHandler } from './bindkeys'

/** Capture host commands before a nested editor keymap consumes them. */
export function createAppShortcutHandler(
  shortcut: string,
  open: (event: KeyboardEvent) => boolean,
  allowedDialogSelector?: string,
) {
  const handler = createKeybindingsHandler(
    shortcut
      ? {
          [shortcut]: (event) => {
            if (!open(event)) return false
            event.preventDefault()
            event.stopPropagation()
            return true
          },
        }
      : {},
  )
  return (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return
    if (
      event
        .composedPath()
        .some(
          (target) =>
            target instanceof Element &&
            target.getAttribute('role') === 'dialog' &&
            (!allowedDialogSelector || !target.matches(allowedDialogSelector)),
        )
    )
      return
    handler(event)
  }
}

export function createFindShortcutHandler(
  shortcut: string,
  open: (event: KeyboardEvent) => boolean,
) {
  return createAppShortcutHandler(shortcut, open)
}
