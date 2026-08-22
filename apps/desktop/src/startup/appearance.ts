export const STARTUP_APPEARANCE_SCHEMA_VERSION = 1 as const
export const STARTUP_APPEARANCE_STORAGE_KEY = 'markflowy:startup-appearance:v1'
export const STARTUP_APPEARANCE_SESSION_STORAGE_KEY = 'markflowy:startup-appearance:session:v1'

export type StartupAppearancePreference = 'light' | 'dark' | 'system'
export type ResolvedAppearanceMode = Exclude<StartupAppearancePreference, 'system'>

export type StartupPalette = {
  surfaceApp: string
  surfacePanel: string
  surfaceToolbar: string
  foreground: string
  mutedForeground: string
  border: string
  accent: string
}

export type StartupAppearance = {
  schemaVersion: typeof STARTUP_APPEARANCE_SCHEMA_VERSION
  preference: StartupAppearancePreference
  resolvedMode: ResolvedAppearanceMode
  themeId: string
  palette: StartupPalette
}

export type WindowBootstrap = {
  appearance: StartupAppearance
  openedUrls: string[]
  sessionId: string
}

export type LegacyWindowBootstrap = Omit<WindowBootstrap, 'openedUrls'> & {
  openedUrls: string
}

export type StartupAppearancePersistence = 'local-storage' | 'native' | 'unavailable'

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const INVALID_THEME_ID_RE = /[\u0000-\u001f\u007f]/
const MAX_THEME_ID_LENGTH = 128

const PALETTE_CSS_PROPERTIES: Record<keyof StartupPalette, string> = {
  surfaceApp: '--mf-boot-surface-app',
  surfacePanel: '--mf-boot-surface-panel',
  surfaceToolbar: '--mf-boot-surface-toolbar',
  foreground: '--mf-boot-foreground',
  mutedForeground: '--mf-boot-muted-foreground',
  border: '--mf-boot-border',
  accent: '--mf-boot-accent',
}

const STARTUP_PALETTE_CSS_PROPERTIES = Object.values(PALETTE_CSS_PROPERTIES)

export const DEFAULT_STARTUP_PALETTES: Record<ResolvedAppearanceMode, StartupPalette> = {
  light: {
    surfaceApp: '#FFFFFF',
    surfacePanel: '#F9F9F9',
    surfaceToolbar: '#FEFEFE',
    foreground: '#000000',
    mutedForeground: '#505050',
    border: '#D2D2D2',
    accent: '#1F6AE2',
  },
  dark: {
    surfaceApp: '#131313',
    surfacePanel: '#1E1D1E',
    surfaceToolbar: '#323232',
    foreground: '#CACCCA',
    mutedForeground: '#9E9E9E',
    border: '#404040',
    accent: '#3794ff',
  },
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPreference = (value: unknown): value is StartupAppearancePreference =>
  value === 'light' || value === 'dark' || value === 'system'

const isResolvedMode = (value: unknown): value is ResolvedAppearanceMode =>
  value === 'light' || value === 'dark'

const isSafeColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX_COLOR_RE.test(value)

const isSafeOpaqueColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{3}f|[0-9a-f]{6}ff)$/i.test(value)

export const normalizeOpenedUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((url): url is string => typeof url === 'string' && url.length > 0)
  }

  // One-release compatibility for bootstrap/event payloads produced before
  // openedUrls became an array. New payloads preserve commas inside paths.
  if (typeof value === 'string') return value.split(',').filter(Boolean)

  return []
}

export const consumeOpenedUrls = (
  value: unknown,
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
): string[] => {
  const consumed = [...new Set(normalizeOpenedUrls(value))]
  if (!targetWindow || consumed.length === 0) return consumed

  const consumedSet = new Set(consumed)
  targetWindow.openedUrls = normalizeOpenedUrls(targetWindow.openedUrls).filter(
    (url) => !consumedSet.has(url),
  )
  return consumed
}

export const restoreOpenedUrls = (
  value: unknown,
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
) => {
  if (!targetWindow) return

  targetWindow.openedUrls = [
    ...new Set([...normalizeOpenedUrls(value), ...normalizeOpenedUrls(targetWindow.openedUrls)]),
  ]
}

const normalizeThemeId = (value: unknown, mode: ResolvedAppearanceMode) => {
  if (typeof value !== 'string') {
    return mode === 'dark' ? 'MarkFlowy Dark' : 'MarkFlowy Light'
  }

  const themeId = value.trim()
  if (
    themeId.length === 0 ||
    themeId.length > MAX_THEME_ID_LENGTH ||
    INVALID_THEME_ID_RE.test(themeId)
  ) {
    return mode === 'dark' ? 'MarkFlowy Dark' : 'MarkFlowy Light'
  }

  return themeId
}

export const getBrowserResolvedMode = (
  targetWindow: Pick<Window, 'matchMedia'> | undefined =
    typeof window === 'undefined' ? undefined : window,
): ResolvedAppearanceMode =>
  targetWindow?.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const normalizeStartupPalette = (
  value: unknown,
  mode: ResolvedAppearanceMode,
): StartupPalette => {
  const fallback = DEFAULT_STARTUP_PALETTES[mode]
  const palette = isRecord(value) ? value : {}

  return {
    surfaceApp: isSafeOpaqueColor(palette.surfaceApp)
      ? palette.surfaceApp
      : fallback.surfaceApp,
    surfacePanel: isSafeColor(palette.surfacePanel) ? palette.surfacePanel : fallback.surfacePanel,
    surfaceToolbar: isSafeColor(palette.surfaceToolbar)
      ? palette.surfaceToolbar
      : fallback.surfaceToolbar,
    foreground: isSafeColor(palette.foreground) ? palette.foreground : fallback.foreground,
    mutedForeground: isSafeColor(palette.mutedForeground)
      ? palette.mutedForeground
      : fallback.mutedForeground,
    border: isSafeColor(palette.border) ? palette.border : fallback.border,
    accent: isSafeColor(palette.accent) ? palette.accent : fallback.accent,
  }
}

export const normalizeStartupAppearance = (
  value: unknown,
  browserMode: ResolvedAppearanceMode = getBrowserResolvedMode(),
): StartupAppearance => {
  const appearance = isRecord(value) ? value : {}
  const preference = isPreference(appearance.preference) ? appearance.preference : 'system'
  const cachedResolvedMode = isResolvedMode(appearance.resolvedMode)
    ? appearance.resolvedMode
    : undefined
  const resolvedMode = preference === 'system' ? browserMode : preference
  const canReuseCachedPalette = cachedResolvedMode === resolvedMode

  return {
    schemaVersion: STARTUP_APPEARANCE_SCHEMA_VERSION,
    preference,
    resolvedMode,
    themeId: normalizeThemeId(canReuseCachedPalette ? appearance.themeId : undefined, resolvedMode),
    palette: normalizeStartupPalette(
      canReuseCachedPalette ? appearance.palette : undefined,
      resolvedMode,
    ),
  }
}

const isTauriWindow = (targetWindow: Window) => '__TAURI_INTERNALS__' in targetWindow

const readAppearanceFromStorage = (storage: Storage, key: string): unknown => {
  try {
    const storedAppearance = storage.getItem(key)
    const parsedAppearance: unknown = storedAppearance ? JSON.parse(storedAppearance) : undefined
    return isRecord(parsedAppearance) &&
      parsedAppearance.schemaVersion === STARTUP_APPEARANCE_SCHEMA_VERSION
      ? parsedAppearance
      : undefined
  } catch {
    return undefined
  }
}

const readSessionAppearance = (targetWindow: Window): unknown => {
  try {
    return readAppearanceFromStorage(
      targetWindow.sessionStorage,
      STARTUP_APPEARANCE_SESSION_STORAGE_KEY,
    )
  } catch {
    return undefined
  }
}

const readStoredAppearance = (targetWindow: Window): unknown => {
  if (isTauriWindow(targetWindow)) return undefined

  try {
    return readAppearanceFromStorage(targetWindow.localStorage, STARTUP_APPEARANCE_STORAGE_KEY)
  } catch {
    return undefined
  }
}

export const readWindowBootstrap = (
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
): StartupAppearance => {
  if (!targetWindow) return normalizeStartupAppearance(undefined, 'light')

  const bootstrap = targetWindow.__MARKFLOWY_BOOTSTRAP__
  const rawBootstrapAppearance = isRecord(bootstrap) ? bootstrap.appearance : undefined
  const bootstrapAppearance =
    isRecord(rawBootstrapAppearance) &&
    rawBootstrapAppearance.schemaVersion === STARTUP_APPEARANCE_SCHEMA_VERSION
      ? rawBootstrapAppearance
      : undefined
  const rawAppearance =
    readSessionAppearance(targetWindow) ?? bootstrapAppearance ?? readStoredAppearance(targetWindow)
  const nativeResolvedMode =
    isTauriWindow(targetWindow) &&
    isRecord(rawAppearance) &&
    isResolvedMode(rawAppearance.resolvedMode)
      ? rawAppearance.resolvedMode
      : undefined
  const appearance = normalizeStartupAppearance(
    rawAppearance,
    nativeResolvedMode ?? getBrowserResolvedMode(targetWindow),
  )
  const rawOpenedUrls =
    isRecord(bootstrap) &&
    (Array.isArray(bootstrap.openedUrls) || typeof bootstrap.openedUrls === 'string')
      ? bootstrap.openedUrls
      : targetWindow.openedUrls
  const openedUrls = normalizeOpenedUrls(rawOpenedUrls)

  targetWindow.__MARKFLOWY_BOOTSTRAP__ = {
    appearance,
    openedUrls,
    sessionId:
      isRecord(bootstrap) && typeof bootstrap.sessionId === 'string'
        ? bootstrap.sessionId
        : 'browser-preview',
  }
  targetWindow.openedUrls = openedUrls

  return appearance
}

export const applyResolvedAppearance = (
  mode: ResolvedAppearanceMode,
  targetDocument: Document | undefined = typeof document === 'undefined' ? undefined : document,
) => {
  if (!targetDocument) return

  const root = targetDocument.documentElement
  root.dataset.mfTheme = mode
  root.style.colorScheme = mode
  if (targetDocument.body) targetDocument.body.style.colorScheme = mode
}

export const applyStartupAppearance = (
  value: unknown,
  targetDocument: Document | undefined = typeof document === 'undefined' ? undefined : document,
): StartupAppearance => {
  const resolvedMode =
    isRecord(value) && isResolvedMode(value.resolvedMode)
      ? value.resolvedMode
      : getBrowserResolvedMode()
  const appearance = normalizeStartupAppearance(value, resolvedMode)
  if (!targetDocument) return appearance

  applyResolvedAppearance(appearance.resolvedMode, targetDocument)
  const rootStyle = targetDocument.documentElement.style
  for (const paletteKey of Object.keys(PALETTE_CSS_PROPERTIES) as (keyof StartupPalette)[]) {
    rootStyle.setProperty(PALETTE_CSS_PROPERTIES[paletteKey], appearance.palette[paletteKey])
  }

  return appearance
}

export const releaseStartupPalette = (
  targetDocument: Document | undefined = typeof document === 'undefined' ? undefined : document,
) => {
  if (!targetDocument) return

  const rootStyle = targetDocument.documentElement.style
  const overlayStyle = targetDocument.getElementById('mf-boot-overlay')?.style

  for (const property of STARTUP_PALETTE_CSS_PROPERTIES) {
    const value = rootStyle.getPropertyValue(property)
    // Keep the still-visible static overlay on its original palette while the
    // runtime theme variables take ownership of the application underneath.
    if (overlayStyle && value) overlayStyle.setProperty(property, value)
    rootStyle.removeProperty(property)
  }
}

export const cacheStartupAppearance = (
  value: unknown,
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
): StartupAppearance => {
  const resolvedMode =
    isRecord(value) && isResolvedMode(value.resolvedMode)
      ? value.resolvedMode
      : getBrowserResolvedMode(targetWindow)
  const appearance = normalizeStartupAppearance(value, resolvedMode)
  if (!targetWindow) return appearance

  try {
    targetWindow.sessionStorage.setItem(
      STARTUP_APPEARANCE_SESSION_STORAGE_KEY,
      JSON.stringify(appearance),
    )
  } catch {
    // The native bootstrap remains the fallback when session storage is unavailable.
  }

  if (!isTauriWindow(targetWindow)) {
    try {
      targetWindow.localStorage.setItem(STARTUP_APPEARANCE_STORAGE_KEY, JSON.stringify(appearance))
    } catch {
      // Browser previews can still use the in-memory bootstrap for this page.
    }
  }

  const bootstrap = targetWindow.__MARKFLOWY_BOOTSTRAP__
  targetWindow.__MARKFLOWY_BOOTSTRAP__ = {
    appearance,
    openedUrls: normalizeOpenedUrls(
      isRecord(bootstrap) ? bootstrap.openedUrls : targetWindow.openedUrls,
    ),
    sessionId:
      isRecord(bootstrap) && typeof bootstrap.sessionId === 'string'
        ? bootstrap.sessionId
        : 'browser-preview',
  }

  return appearance
}

export const persistStartupAppearance = async (
  value: unknown,
  targetWindow: Window | undefined = typeof window === 'undefined' ? undefined : window,
): Promise<StartupAppearancePersistence> => {
  const appearance = cacheStartupAppearance(value, targetWindow)

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_startup_appearance', { appearance })
    return 'native'
  } catch {
    if (!targetWindow || isTauriWindow(targetWindow)) return 'unavailable'
  }

  if (!targetWindow) return 'unavailable'

  try {
    targetWindow.localStorage.setItem(STARTUP_APPEARANCE_STORAGE_KEY, JSON.stringify(appearance))
    return 'local-storage'
  } catch {
    return 'unavailable'
  }
}
