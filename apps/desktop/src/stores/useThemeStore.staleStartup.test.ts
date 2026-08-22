import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadThemeCss: vi.fn(),
  removeInsertedTheme: vi.fn(),
  setTheme: vi.fn(),
  writeSettingData: vi.fn(),
}))

vi.mock('@/helper/extensions', () => ({
  loadThemeCss: mocks.loadThemeCss,
  removeInsertedTheme: mocks.removeInsertedTheme,
}))

vi.mock('@/services/app-setting', () => ({
  default: { writeSettingData: mocks.writeSettingData },
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onThemeChanged: vi.fn(async () => () => undefined),
    setTheme: mocks.setTheme,
    theme: vi.fn(async () => 'dark'),
  }),
}))

const customDarkAppearance = {
  schemaVersion: 1 as const,
  preference: 'dark' as const,
  resolvedMode: 'dark' as const,
  themeId: 'Local Midnight',
  palette: {
    surfaceApp: '#101214',
    surfacePanel: '#17191b',
    surfaceToolbar: '#1d2023',
    foreground: '#f2f3f4',
    mutedForeground: '#9fa3a8',
    border: '#30343a',
    accent: '#3b82f6',
  },
}

beforeEach(() => {
  vi.resetModules()
  mocks.loadThemeCss.mockClear()
  mocks.removeInsertedTheme.mockClear()
  mocks.setTheme.mockClear()
  mocks.writeSettingData.mockClear()
  window.sessionStorage.clear()
  window.__MARKFLOWY_BOOTSTRAP__ = {
    appearance: customDarkAppearance,
    openedUrls: [],
    sessionId: 'theme-test',
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn(
      () =>
        ({
          addEventListener: vi.fn(),
          matches: true,
          media: '(prefers-color-scheme: dark)',
        }) as unknown as MediaQueryList,
    ),
  })
  Reflect.deleteProperty(window, '__markflowyThemeSyncSetup')
})

afterEach(() => {
  delete window.__MARKFLOWY_BOOTSTRAP__
  document.documentElement.removeAttribute('data-mf-startup-theme-fallback')
  document.querySelectorAll('[data-mf-startup-theme-transition-guard]').forEach((node) => {
    node.remove()
  })
})

describe('stale synthetic startup theme', () => {
  it('falls back to the built-in theme in the same mode without changing settings', async () => {
    const { default: useThemeStore, FALLBACK_DARK_THEME } = await import('./useThemeStore')

    expect(useThemeStore.getState().curTheme).toMatchObject({
      mode: 'dark',
      name: 'Local Midnight',
    })

    const staleTheme = useThemeStore.getState().fallbackStaleStartupTheme()

    expect(staleTheme?.name).toBe('Local Midnight')
    expect(useThemeStore.getState().curTheme).toMatchObject({
      mode: 'dark',
      name: FALLBACK_DARK_THEME,
    })
    expect(useThemeStore.getState().themes.some((theme) => theme.name === 'Local Midnight')).toBe(
      false,
    )
    expect(mocks.writeSettingData).not.toHaveBeenCalled()
  })

  it('does nothing after a real extension theme replaced the synthetic one', async () => {
    const { default: useThemeStore } = await import('./useThemeStore')
    const registeredTheme = {
      ...useThemeStore.getState().curTheme,
      globalStyleText: ':root { --extension-theme-ready: 1; }',
    }

    useThemeStore.getState().insertTheme(registeredTheme)

    expect(useThemeStore.getState().curTheme).toBe(registeredTheme)
    expect(useThemeStore.getState().fallbackStaleStartupTheme()).toBeUndefined()
    expect(useThemeStore.getState().curTheme).toBe(registeredTheme)
  })
})
