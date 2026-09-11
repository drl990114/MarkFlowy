export type ShortcutMatcherFactory = (shortcut: string) => (event: KeyboardEvent) => boolean
export type ShortcutMap = Record<string, string | readonly string[]>

/** An array contains alternative bindings, not successive chord strokes. */
export function shortcutAlternatives(shortcuts: string | readonly string[]): readonly string[] {
  return typeof shortcuts === 'string' ? (shortcuts ? [shortcuts] : []) : shortcuts.filter(Boolean)
}

/** AltGr produces text. Stop shortcut listeners without cancelling the browser's input action. */
export function protectAltGraphInput(element: HTMLElement): () => void {
  const guard = (event: KeyboardEvent) => {
    if (event.getModifierState?.('AltGraph')) event.stopPropagation()
  }
  element.addEventListener('keydown', guard, true)
  return () => element.removeEventListener('keydown', guard, true)
}

/** Standalone RME default. Hosts may inject their own compiled keyboard-layout resolver. */
export const createShortcutMatcher: ShortcutMatcherFactory = (shortcut) => {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  const parts = shortcut.split(/-(?!$)/)
  const primary = parts.pop() ?? ''
  const modifiers = new Set(
    parts.map((part) => {
      const lower = part.toLowerCase()
      if (lower === 'mod' || lower === 'commandorctrl') return mac ? 'meta' : 'ctrl'
      if (lower === 'cmd' || lower === 'command') return 'meta'
      if (lower === 'control') return 'ctrl'
      if (lower === 'option') return 'alt'
      return lower
    }),
  )
  const code = /^\[(.+)\]$/.exec(primary)?.[1]
  return (event) => {
    if (
      !primary ||
      event.isComposing ||
      event.keyCode === 229 ||
      event.getModifierState?.('AltGraph')
    )
      return false
    return (
      event.ctrlKey === modifiers.has('ctrl') &&
      event.metaKey === modifiers.has('meta') &&
      event.altKey === modifiers.has('alt') &&
      event.shiftKey === modifiers.has('shift') &&
      (code
        ? event.code === code
        : (event.key === ' ' ? 'space' : event.key.toLowerCase()) === primary.toLowerCase())
    )
  }
}
