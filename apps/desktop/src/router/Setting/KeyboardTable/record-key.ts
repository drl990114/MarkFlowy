import { keybindingPlatform, normalizeKeyMap } from '@/commands/keybindingKeys'

export function recordKey(event: KeyboardEvent) {
  if (
    event.isComposing ||
    event.keyCode === 229 ||
    event.getModifierState?.('AltGraph') ||
    ['Dead', 'Process', 'Unidentified'].includes(event.key)
  )
    return null
  if (
    ['Tab', 'Escape', 'Enter'].includes(event.key) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  )
    return null
  event.preventDefault()
  event.stopPropagation()
  if (['Control', 'Meta', 'Alt', 'Shift', 'AltGraph'].includes(event.key)) return null
  const mac = keybindingPlatform() === 'mac'
  const keys: string[] = []
  if (event.ctrlKey) keys.push(mac ? 'Ctrl' : 'CommandOrCtrl')
  if (event.metaKey) keys.push(mac ? 'CommandOrCtrl' : 'Meta')
  if (event.altKey) keys.push('Alt')
  if (event.shiftKey) keys.push('Shift')
  // Semantic characters follow the active layout. Numpad keys retain their physical identity.
  keys.push(
    event.code.startsWith('Numpad') && event.code !== 'NumpadEnter' ? `[${event.code}]` : event.key,
  )
  return normalizeKeyMap(keys)
}
