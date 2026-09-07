import { createKeybindingsHandler } from './bindkeys'

/** Only the document Find command precedes nested editor keymaps. */
export function createFindShortcutHandler(shortcut: string, open: () => boolean) {
  const handler = createKeybindingsHandler(
    shortcut
      ? {
          [shortcut]: (event) => {
            if (!open()) return false
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
        .some((target) => target instanceof Element && target.getAttribute('role') === 'dialog')
    )
      return
    handler(event)
  }
}
