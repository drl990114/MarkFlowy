import type { Command, Disposable } from '@/commands'
import { EVENT } from '@/constants'

export const ZEN_MODE_ESCAPE_INTERVAL_MS = 800
export const ZEN_MODE_HINT_DURATION_MS = 2500

export interface ZenModeCommandRegistry {
  registerCommand: (command: Command) => Disposable
}

export interface ZenModeCommandOptions {
  handler: () => void
  label: string
}

export function registerZenModeCommand(
  registry: ZenModeCommandRegistry,
  options: ZenModeCommandOptions,
): Disposable {
  return registry.registerCommand({
    id: EVENT.app_toggleZenMode,
    label: options.label,
    category: 'View',
    handler: options.handler,
  })
}

export interface ZenModeToggleOptions {
  active: boolean
  hasActiveDocument: boolean
  onToggled: (active: boolean) => void
  onUnavailable: () => void
}

export function requestZenModeToggle(options: ZenModeToggleOptions): boolean {
  const { active, hasActiveDocument, onToggled, onUnavailable } = options

  if (!active && !hasActiveDocument) {
    onUnavailable()
    return false
  }

  onToggled(!active)
  return true
}

export interface DoubleEscapeInput {
  defaultPrevented: boolean
  isComposing: boolean
  key: string
  now: number
  repeat: boolean
}

export interface DoubleEscapeResult {
  exitZenMode: boolean
  lastEscapeAt: number | null
}

export interface QueuedDoubleEscapeOptions {
  event: KeyboardEvent
  getLastEscapeAt: () => number | null
  isActive: () => boolean
  now: number
  onExit: () => void
  setLastEscapeAt: (lastEscapeAt: number | null) => void
}

export function resolveDoubleEscape(
  lastEscapeAt: number | null,
  input: DoubleEscapeInput,
): DoubleEscapeResult {
  if (input.key !== 'Escape') {
    return { exitZenMode: false, lastEscapeAt: null }
  }

  if (input.defaultPrevented || input.isComposing || input.repeat) {
    return { exitZenMode: false, lastEscapeAt: null }
  }

  if (
    lastEscapeAt !== null &&
    input.now >= lastEscapeAt &&
    input.now - lastEscapeAt <= ZEN_MODE_ESCAPE_INTERVAL_MS
  ) {
    return { exitZenMode: true, lastEscapeAt: null }
  }

  return { exitZenMode: false, lastEscapeAt: input.now }
}

export function queueDoubleEscapeResolution(options: QueuedDoubleEscapeOptions): void {
  queueMicrotask(() => {
    if (!options.isActive()) return

    const result = resolveDoubleEscape(options.getLastEscapeAt(), {
      defaultPrevented: options.event.defaultPrevented,
      isComposing: options.event.isComposing,
      key: options.event.key,
      now: options.now,
      repeat: options.event.repeat,
    })
    options.setLastEscapeAt(result.lastEscapeAt)

    if (result.exitZenMode) options.onExit()
  })
}
