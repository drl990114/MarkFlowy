import type { MfTheme } from '@markflowy/theme'

export interface ThemeExtension {
  id: string
  path: string
  pkg: string
  script_text?: string | null
}

type ThemeIdentity = Pick<MfTheme, 'mode' | 'name'>

type ThemeDescriptor = {
  mode?: unknown
  modes?: unknown
  name?: unknown
}

type ThemePackageManifest = {
  displayName?: unknown
  markflowy?: {
    theme?: unknown
  }
  markflowyTheme?: unknown
  mode?: unknown
  modes?: unknown
  name?: unknown
  theme?: unknown
}

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number
}

type YieldScheduler = {
  yield?: () => Promise<void>
}

export type ScheduleThemeExtensionChunk = (task: () => void) => Promise<void>

const descriptorMatches = (
  descriptor: unknown,
  identity: ThemeIdentity,
): boolean => {
  if (typeof descriptor === 'string') return descriptor === identity.name
  if (!descriptor || typeof descriptor !== 'object') return false

  const { mode, modes, name } = descriptor as ThemeDescriptor
  if (name !== identity.name) return false
  if (mode !== undefined && mode !== identity.mode) return false
  if (Array.isArray(modes) && !modes.includes(identity.mode)) return false

  return true
}

const packageMatchesTheme = (pkg: string, identity: ThemeIdentity): boolean => {
  try {
    const manifest = JSON.parse(pkg) as ThemePackageManifest
    // `manifest.name` is the package id in the existing community theme format,
    // not the registered MfTheme name. Only use explicit display/theme metadata.
    if (manifest.displayName === identity.name) {
      return descriptorMatches(
        {
          mode: manifest.mode,
          modes: manifest.modes,
          name: identity.name,
        },
        identity,
      )
    }

    return [manifest.theme, manifest.markflowyTheme, manifest.markflowy?.theme].some(
      (descriptor) => descriptorMatches(descriptor, identity),
    )
  } catch {
    return false
  }
}

const scriptMatchesTheme = (
  scriptText: string | null | undefined,
  identity: ThemeIdentity,
): boolean => {
  if (!scriptText) return false

  const escapedName = JSON.stringify(identity.name).slice(1, -1)
  if (!scriptText.includes(identity.name) && !scriptText.includes(escapedName)) {
    return false
  }

  const targetModePattern = new RegExp(
    `["']?mode["']?\\s*:\\s*["']${identity.mode}["']`,
  )
  const otherMode = identity.mode === 'dark' ? 'light' : 'dark'
  const otherModePattern = new RegExp(`["']?mode["']?\\s*:\\s*["']${otherMode}["']`)

  return targetModePattern.test(scriptText) || !otherModePattern.test(scriptText)
}

export const extensionMatchesTheme = (
  extension: ThemeExtension,
  identity: ThemeIdentity,
): boolean =>
  packageMatchesTheme(extension.pkg, identity) ||
  scriptMatchesTheme(extension.script_text, identity)

export const scheduleThemeExtensionChunk: ScheduleThemeExtensionChunk = (task) =>
  new Promise((resolve) => {
    const run = () => {
      try {
        task()
      } finally {
        resolve()
      }
    }

    const targetWindow = typeof window === 'undefined' ? undefined : (window as IdleWindow)
    if (typeof targetWindow?.requestIdleCallback === 'function') {
      targetWindow.requestIdleCallback(run, { timeout: 500 })
      return
    }

    const scheduler = (globalThis as typeof globalThis & { scheduler?: YieldScheduler })
      .scheduler
    if (typeof scheduler?.yield === 'function') {
      void scheduler.yield().then(run, run)
      return
    }

    setTimeout(run, 0)
  })

interface LoadThemeExtensionsIncrementallyOptions {
  extensions: ThemeExtension[]
  currentTheme?: ThemeIdentity
  loadExtension: (extension: ThemeExtension) => void
  onError: (extension: ThemeExtension, error: unknown) => void
  scheduleChunk?: ScheduleThemeExtensionChunk
}

/**
 * The selected cached theme is restored first. Every other extension runs in
 * its own event-loop/idle chunk so a large catalog cannot monopolize a frame.
 */
export const loadThemeExtensionsIncrementally = async ({
  extensions,
  currentTheme,
  loadExtension,
  onError,
  scheduleChunk = scheduleThemeExtensionChunk,
}: LoadThemeExtensionsIncrementallyOptions): Promise<void> => {
  const currentIndex = currentTheme
    ? extensions.findIndex((extension) => extensionMatchesTheme(extension, currentTheme))
    : -1
  const currentExtension = currentIndex >= 0 ? extensions[currentIndex] : undefined
  const backgroundExtensions = currentExtension
    ? extensions.filter((_, index) => index !== currentIndex)
    : extensions

  const loadSafely = (extension: ThemeExtension) => {
    try {
      loadExtension(extension)
    } catch (error) {
      onError(extension, error)
    }
  }

  if (currentExtension) loadSafely(currentExtension)

  for (const extension of backgroundExtensions) {
    await scheduleChunk(() => loadSafely(extension))
  }
}
