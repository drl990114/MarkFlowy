import { getKeybindingCommand } from './keybindingCatalog'

export type KeybindingPlatform = 'mac' | 'windows' | 'linux'

export function keybindingPlatform(): KeybindingPlatform {
  const platform =
    typeof navigator === 'undefined' ? '' : `${navigator.platform} ${navigator.userAgent}`
  return /Mac|iPhone|iPad/i.test(platform) ? 'mac' : /Win/i.test(platform) ? 'windows' : 'linux'
}

const modifierAliases: Record<string, string> = {
  commandorctrl: 'CommandOrCtrl',
  mod: 'CommandOrCtrl',
  control: 'Ctrl',
  ctrl: 'Ctrl',
  cmd: 'Meta',
  command: 'Meta',
  meta: 'Meta',
  alt: 'Alt',
  option: 'Alt',
  shift: 'Shift',
}
const namedKeys = [
  'Space',
  'Tab',
  'Enter',
  'Escape',
  'Backspace',
  'Delete',
  'Insert',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'CapsLock',
  'Pause',
]
const physicalCodes = [
  ...namedKeys,
  'Backquote',
  'Backslash',
  'BracketLeft',
  'BracketRight',
  'Comma',
  'Equal',
  'Minus',
  'Period',
  'Quote',
  'Semicolon',
  'Slash',
  ...Array.from({ length: 26 }, (_, index) => `Key${String.fromCharCode(65 + index)}`),
  ...Array.from({ length: 10 }, (_, index) => `Digit${index}`),
  ...Array.from({ length: 10 }, (_, index) => `Numpad${index}`),
  ...['Add', 'Comma', 'Decimal', 'Divide', 'Multiply', 'Subtract'].map((key) => `Numpad${key}`),
  ...Array.from({ length: 19 }, (_, index) => `F${index + 1}`),
]

// NumLock and locale can change a numpad key's semantic value without changing its code.
const numpadValues: Record<string, readonly string[]> = {
  Numpad0: ['0', 'Insert'],
  Numpad1: ['1', 'End'],
  Numpad2: ['2', 'ArrowDown'],
  Numpad3: ['3', 'PageDown'],
  Numpad4: ['4', 'ArrowLeft'],
  Numpad5: ['5', 'Clear'],
  Numpad6: ['6', 'ArrowRight'],
  Numpad7: ['7', 'Home'],
  Numpad8: ['8', 'ArrowUp'],
  Numpad9: ['9', 'PageUp'],
  NumpadAdd: ['+'],
  NumpadSubtract: ['-'],
  NumpadMultiply: ['*'],
  NumpadDivide: ['/'],
  NumpadDecimal: ['.', ',', 'Delete'],
  NumpadComma: [',', '.'],
}

const modifierOrder = ['CommandOrCtrl', 'Ctrl', 'Meta', 'Alt', 'Shift']

/** Preserve the portable modifier in storage, but canonicalize every other spelling. */
export function normalizeKeyMap(keys: readonly string[]): string[] | null {
  if (!keys.length) return []
  const modifiers = new Set<string>()
  let primary: string | undefined
  for (const value of keys) {
    const modifier = modifierAliases[value.toLowerCase()]
    if (modifier) {
      modifiers.add(modifier)
      continue
    }
    if (primary !== undefined) return null
    const physical = /^\[(.+)\]$/.exec(value)?.[1]
    primary = physical
      ? physicalCodes.find((key) => key.toLowerCase() === physical.toLowerCase())
      : value === ' '
        ? 'Space'
        : value.length === 1
          ? value.toLowerCase()
          : (namedKeys.find((key) => key.toLowerCase() === value.toLowerCase()) ??
            (/^F(?:[1-9]|1[0-9])$/i.test(value) ? value.toUpperCase() : undefined))
    if (!primary) return null
    if (physical) primary = `[${primary}]`
  }

  return primary ? [...modifierOrder.filter((key) => modifiers.has(key)), primary] : null
}

export function keyMapsOverlap(
  left: readonly string[],
  right: readonly string[],
  platform = keybindingPlatform(),
): boolean {
  const a = canonicalKeyMap(left, platform)
  const b = canonicalKeyMap(right, platform)
  if (!a || !b) return false
  if (a === b) return true
  // Compare each stable semantic alias using the same modifiers as dispatch.
  return [left, right].some((keys, index) => {
    const normalized = normalizeKeyMap(keys)!
    const code = normalized.at(-1)!.slice(1, -1)
    return (numpadValues[code] ?? []).some(
      (key) =>
        canonicalKeyMap([...normalized.slice(0, -1), key], platform) === (index === 0 ? b : a),
    )
  })
}

export function canonicalKeyMap(keys: readonly string[], platform = keybindingPlatform()): string {
  const normalized = normalizeKeyMap(keys)
  if (!normalized?.length) return ''
  const primary = normalized.at(-1)!
  const modifiers = new Set(
    normalized
      .slice(0, -1)
      .map((key) => (key === 'CommandOrCtrl' ? (platform === 'mac' ? 'Meta' : 'Ctrl') : key)),
  )
  return [...modifierOrder.filter((key) => modifiers.has(key)), primary].join('-')
}

/** Stored identity keeps portable Mod distinct from a platform-specific modifier. */
export function sameKeyMap(left: readonly string[], right: readonly string[]): boolean {
  const a = normalizeKeyMap(left) ?? left
  const b = normalizeKeyMap(right) ?? right
  return a.length === b.length && a.every((key, index) => key === b[index])
}

export function shortcutString(keys: readonly string[]): string {
  return (normalizeKeyMap(keys) ?? [])
    .map((key) => (key === 'CommandOrCtrl' ? 'mod' : key))
    .join('-')
}

export function validateKeyMap(
  keys: readonly string[],
  commandId: string,
  platform = keybindingPlatform(),
): 'invalid' | 'reserved' | undefined {
  const normalized = normalizeKeyMap(keys)
  if (!normalized) return 'invalid'
  if (!normalized.length) return undefined
  const primary = normalized.at(-1)!
  if (!normalized.slice(0, -1).some((key) => key !== 'Shift') && !/^\[?F\d+\]?$/.test(primary))
    return 'reserved'
  const structuralKey = primary.replace(/^\[|\]$/g, '')
  if (
    getKeybindingCommand(commandId)?.target === 'editor' &&
    /^(Arrow|Enter$|Tab$|Backspace$|Delete$|Home$|End$|Page)/.test(structuralKey)
  )
    return 'reserved'
  const clipboardKey = /^\[Key[CVX]\]$/.test(primary) ? primary[4].toLowerCase() : primary
  const canonical = canonicalKeyMap([...normalized.slice(0, -1), clipboardKey], platform)
  const mod = platform === 'mac' ? 'Meta' : 'Ctrl'
  if (canonical === `${mod}-c` && commandId !== 'editor_copy') return 'reserved'
  if (canonical === `${mod}-x` && commandId !== 'editor_cut') return 'reserved'
  if (canonical.split('-').includes(mod) && clipboardKey === 'v' && commandId !== 'editor_paste')
    return 'reserved'
  return undefined
}

export function formatKeyMap(keys: readonly string[], platform = keybindingPlatform()): string {
  const symbols: Record<string, string> =
    platform === 'mac'
      ? { CommandOrCtrl: '⌘', Meta: '⌘', Ctrl: '⌃', Alt: '⌥', Shift: '⇧' }
      : { CommandOrCtrl: 'Ctrl', Meta: 'Meta' }
  return (normalizeKeyMap(keys) ?? keys)
    .map((key) => symbols[key] ?? (key.length === 1 ? key.toUpperCase() : key))
    .join(platform === 'mac' ? '' : '+')
}
