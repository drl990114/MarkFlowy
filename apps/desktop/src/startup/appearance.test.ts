import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyStartupAppearance,
  cacheStartupAppearance,
  consumeOpenedUrls,
  DEFAULT_STARTUP_PALETTES,
  normalizeOpenedUrls,
  normalizeStartupAppearance,
  persistStartupAppearance,
  readWindowBootstrap,
  releaseStartupPalette,
  restoreOpenedUrls,
  STARTUP_APPEARANCE_SESSION_STORAGE_KEY,
  STARTUP_APPEARANCE_STORAGE_KEY,
} from './appearance'
import { mergeRegisteredTheme, resolveStartupTheme } from './appearanceTheme'

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: invokeMock }))

const customDarkAppearance = {
  schemaVersion: 1,
  preference: 'system',
  resolvedMode: 'dark',
  themeId: 'Local Midnight',
  palette: {
    surfaceApp: '#101214',
    surfacePanel: '#17191b',
    surfaceToolbar: '#1d2023',
    foreground: '#f2f3f4',
    mutedForeground: '#abcd',
    border: '#30343a',
    accent: '#3b82f6cc',
  },
}

beforeEach(() => {
  invokeMock.mockReset()
  invokeMock.mockRejectedValue(new Error('Tauri is unavailable'))
  window.localStorage.clear()
  window.sessionStorage.clear()
  delete window.__MARKFLOWY_BOOTSTRAP__
  window.openedUrls = null
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: query.includes('dark'),
        media: query,
      }) as MediaQueryList,
  )
})

afterEach(() => {
  vi.restoreAllMocks()
  document.getElementById('mf-boot-overlay')?.remove()
  document.documentElement.removeAttribute('data-mf-theme')
  document.documentElement.removeAttribute('style')
  document.body.removeAttribute('style')
})

describe('startup appearance bootstrap', () => {
  it('keeps only safe palette colors and falls back invalid fields independently', () => {
    const appearance = normalizeStartupAppearance(
      {
        ...customDarkAppearance,
        palette: {
          ...customDarkAppearance.palette,
          surfaceApp: '#10121480',
          border: 'red; background: white',
          foreground: '#abcde',
        },
      },
      'dark',
    )

    expect(appearance.palette).toEqual({
      ...customDarkAppearance.palette,
      surfaceApp: DEFAULT_STARTUP_PALETTES.dark.surfaceApp,
      border: DEFAULT_STARTUP_PALETTES.dark.border,
      foreground: DEFAULT_STARTUP_PALETTES.dark.foreground,
    })
  })

  it('prefers the native window bootstrap over browser preview storage', () => {
    window.localStorage.setItem(
      STARTUP_APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        preference: 'light',
        resolvedMode: 'light',
        themeId: 'Stored Light',
      }),
    )
    window.__MARKFLOWY_BOOTSTRAP__ = {
      appearance: normalizeStartupAppearance(customDarkAppearance, 'dark'),
      openedUrls: ['file:///tmp/notes,2026.md'],
      sessionId: 'session-1',
    }

    const appearance = readWindowBootstrap(window)

    expect(appearance).toMatchObject({
      preference: 'system',
      resolvedMode: 'dark',
      themeId: 'Local Midnight',
    })
    expect(window.__MARKFLOWY_BOOTSTRAP__?.appearance).toEqual(appearance)
    expect(window.__MARKFLOWY_BOOTSTRAP__).toMatchObject({
      openedUrls: ['file:///tmp/notes,2026.md'],
      sessionId: 'session-1',
    })
    expect(window.openedUrls).toEqual(['file:///tmp/notes,2026.md'])
    expect(Object.keys(window.__MARKFLOWY_BOOTSTRAP__ ?? {}).sort()).toEqual([
      'appearance',
      'openedUrls',
      'sessionId',
    ])
  })

  it('prefers the current webview session snapshot over a stale native reload bootstrap', () => {
    const staleLightAppearance = normalizeStartupAppearance(
      {
        ...customDarkAppearance,
        preference: 'light',
        resolvedMode: 'light',
        themeId: 'MarkFlowy Light',
        palette: DEFAULT_STARTUP_PALETTES.light,
      },
      'light',
    )
    window.__MARKFLOWY_BOOTSTRAP__ = {
      appearance: staleLightAppearance,
      openedUrls: [],
      sessionId: 'native-session',
    }
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })

    cacheStartupAppearance(customDarkAppearance, window)
    window.__MARKFLOWY_BOOTSTRAP__ = {
      appearance: staleLightAppearance,
      openedUrls: [],
      sessionId: 'native-session',
    }

    expect(window.sessionStorage.getItem(STARTUP_APPEARANCE_SESSION_STORAGE_KEY)).not.toBeNull()
    expect(readWindowBootstrap(window)).toMatchObject({
      resolvedMode: 'dark',
      themeId: 'Local Midnight',
    })
  })

  it('preserves commas in array payloads and normalizes the legacy string payload', () => {
    expect(normalizeOpenedUrls(['file:///tmp/notes,2026.md'])).toEqual([
      'file:///tmp/notes,2026.md',
    ])
    expect(normalizeOpenedUrls('file:///tmp/one.md,file:///tmp/two.md')).toEqual([
      'file:///tmp/one.md',
      'file:///tmp/two.md',
    ])
  })

  it('consumes only the claimed open-path batch and preserves paths that arrive later', () => {
    window.openedUrls = ['file:///tmp/A.md']
    const firstBatch = consumeOpenedUrls(window.openedUrls, window)

    expect(firstBatch).toEqual(['file:///tmp/A.md'])
    expect(window.openedUrls).toEqual([])

    window.openedUrls = ['file:///tmp/B.md']
    restoreOpenedUrls(firstBatch, window)
    expect(window.openedUrls).toEqual(['file:///tmp/A.md', 'file:///tmp/B.md'])

    expect(consumeOpenedUrls(['file:///tmp/B.md'], window)).toEqual([
      'file:///tmp/B.md',
    ])
    expect(window.openedUrls).toEqual(['file:///tmp/A.md'])
  })

  it('uses versioned local storage only as a browser-preview fallback', () => {
    window.localStorage.setItem(
      STARTUP_APPEARANCE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        preference: 'light',
        resolvedMode: 'light',
        themeId: 'Stored Light',
        palette: DEFAULT_STARTUP_PALETTES.light,
      }),
    )

    expect(readWindowBootstrap(window)).toMatchObject({
      preference: 'light',
      resolvedMode: 'light',
      themeId: 'Stored Light',
    })

    delete window.__MARKFLOWY_BOOTSTRAP__
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    expect(readWindowBootstrap(window)).toMatchObject({
      preference: 'system',
      resolvedMode: 'dark',
      themeId: 'MarkFlowy Dark',
    })
  })

  it('rejects browser-preview appearance snapshots from an unknown schema', () => {
    window.localStorage.setItem(
      STARTUP_APPEARANCE_STORAGE_KEY,
      JSON.stringify({ ...customDarkAppearance, schemaVersion: 2 }),
    )

    expect(readWindowBootstrap(window)).toEqual({
      schemaVersion: 1,
      preference: 'system',
      resolvedMode: 'dark',
      themeId: 'MarkFlowy Dark',
      palette: DEFAULT_STARTUP_PALETTES.dark,
    })
  })

  it('re-resolves system mode and discards a palette cached for the other mode', () => {
    const appearance = normalizeStartupAppearance(customDarkAppearance, 'light')

    expect(appearance).toEqual({
      schemaVersion: 1,
      preference: 'system',
      resolvedMode: 'light',
      themeId: 'MarkFlowy Light',
      palette: DEFAULT_STARTUP_PALETTES.light,
    })
  })

  it('keeps the native resolved mode authoritative over a transient webview query', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as MediaQueryList)
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    window.__MARKFLOWY_BOOTSTRAP__ = {
      appearance: normalizeStartupAppearance(customDarkAppearance, 'dark'),
      openedUrls: [],
      sessionId: 'native-session',
    }
    expect(readWindowBootstrap(window)).toMatchObject({
      preference: 'system',
      resolvedMode: 'dark',
      themeId: 'Local Midnight',
    })
  })

  it('applies the resolved mode and boot palette synchronously to the document', () => {
    const appearance = applyStartupAppearance(customDarkAppearance, document)

    expect(document.documentElement.dataset.mfTheme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.body.style.colorScheme).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--mf-boot-surface-app')).toBe(
      appearance.palette.surfaceApp,
    )
    expect(document.documentElement.style.getPropertyValue('--mf-boot-accent')).toBe(
      appearance.palette.accent,
    )
  })

  it('hands palette ownership to the runtime theme without recoloring the boot overlay', () => {
    const overlay = document.createElement('div')
    overlay.id = 'mf-boot-overlay'
    document.body.appendChild(overlay)
    const appearance = applyStartupAppearance(customDarkAppearance, document)

    releaseStartupPalette(document)

    expect(
      document.documentElement.style.getPropertyValue('--mf-boot-surface-app'),
    ).toBe('')
    expect(overlay.style.getPropertyValue('--mf-boot-surface-app')).toBe(
      appearance.palette.surfaceApp,
    )
    expect(overlay.style.getPropertyValue('--mf-boot-accent')).toBe(appearance.palette.accent)
    overlay.remove()
  })

  it('uses local storage only when native persistence is unavailable in a browser preview', async () => {
    expect(await persistStartupAppearance(customDarkAppearance, window)).toBe('local-storage')
    expect(window.localStorage.getItem(STARTUP_APPEARANCE_STORAGE_KEY)).not.toBeNull()

    window.localStorage.clear()
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    expect(await persistStartupAppearance(customDarkAppearance, window)).toBe('unavailable')
    expect(window.localStorage.getItem(STARTUP_APPEARANCE_STORAGE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(STARTUP_APPEARANCE_SESSION_STORAGE_KEY)).not.toBeNull()
  })
})

describe('startup theme handoff', () => {
  it('keeps a custom cached palette after the React theme provider mounts', () => {
    const appearance = normalizeStartupAppearance(customDarkAppearance, 'dark')
    const { synthetic, theme } = resolveStartupTheme(appearance)

    expect(synthetic).toBe(true)
    expect(theme).toMatchObject({ name: 'Local Midnight', mode: 'dark' })
    expect(theme.styledConstants).toMatchObject({
      accentColor: '#3b82f6cc',
      bgColor: '#101214',
      borderColor: '#30343a',
      primaryFontColor: '#f2f3f4',
      rightBarBgColor: '#17191b',
      sideBarBgColor: '#17191b',
      titleBarBgColor: '#1d2023',
      unselectedFontColor: '#abcd',
    })
  })

  it('replaces the synthetic cached theme when the real extension theme registers', () => {
    const appearance = normalizeStartupAppearance(customDarkAppearance, 'dark')
    const { theme: syntheticTheme } = resolveStartupTheme(appearance)
    const registeredTheme = {
      ...syntheticTheme,
      globalStyleText: ':root { --extension-theme-ready: 1; }',
    }

    const themes = mergeRegisteredTheme([syntheticTheme], registeredTheme, syntheticTheme)

    expect(themes).toEqual([registeredTheme])
    expect(themes?.[0]).toBe(registeredTheme)
  })

  it('does not replace a cached dark theme with an opposite-mode theme of the same name', () => {
    const appearance = normalizeStartupAppearance(customDarkAppearance, 'dark')
    const { theme: syntheticTheme } = resolveStartupTheme(appearance)
    const oppositeModeTheme = {
      ...syntheticTheme,
      mode: 'light' as const,
    }

    const themes = mergeRegisteredTheme(
      [syntheticTheme],
      oppositeModeTheme,
      syntheticTheme,
    )

    expect(themes).toEqual([syntheticTheme, oppositeModeTheme])
    expect(themes?.[0]).toBe(syntheticTheme)
  })

  it('reuses an exact built-in theme without creating a synthetic copy', () => {
    const appearance = normalizeStartupAppearance(
      {
        ...customDarkAppearance,
        themeId: 'MarkFlowy Dark',
      },
      'dark',
    )

    expect(resolveStartupTheme(appearance)).toMatchObject({
      synthetic: false,
      theme: { name: 'MarkFlowy Dark', mode: 'dark' },
    })
  })
})
