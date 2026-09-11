import { canonicalKeyMap, keybindingPlatform } from '@/commands/keybindingKeys'

export type KeyBindingMap = Record<string, (event: KeyboardEvent) => boolean | void>

/** Resolve once, then compare the original event without layout-dependent keyCode fallbacks. */
export function createShortcutMatcher(shortcut: string): (event: KeyboardEvent) => boolean {
  const platform = keybindingPlatform()
  const canonical = canonicalKeyMap(shortcut.split(/-(?!$)/), platform)
  const parts = canonical.split(/-(?!$)/)
  const primary = parts.pop() ?? ''
  const code = /^\[(.+)\]$/.exec(primary)?.[1]
  const ctrl = parts.includes('Ctrl')
  const meta = parts.includes('Meta')
  const alt = parts.includes('Alt')
  const shift = parts.includes('Shift')
  return (event) => {
    if (
      !canonical ||
      event.isComposing ||
      event.keyCode === 229 ||
      event.getModifierState?.('AltGraph')
    )
      return false
    return (
      Boolean(event.ctrlKey) === ctrl &&
      Boolean(event.metaKey) === meta &&
      Boolean(event.altKey) === alt &&
      Boolean(event.shiftKey) === shift &&
      (code
        ? event.code === code
        : (event.key === ' ' ? 'space' : event.key.toLowerCase()) === primary.toLowerCase())
    )
  }
}

/** One matcher contract for app commands and host-configured editor commands. */
export function keydownHandler(bindings: KeyBindingMap): (event: KeyboardEvent) => boolean {
  const rules = Object.entries(bindings).map(([key, action]) => ({
    matches: createShortcutMatcher(key),
    action,
  }))
  return (event) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.keyCode === 229 ||
      event.getModifierState?.('AltGraph')
    )
      return false
    for (const { matches, action } of rules) {
      if (matches(event) && action(event) !== false) return true
    }
    return false
  }
}

export const createKeybindingsHandler = keydownHandler
