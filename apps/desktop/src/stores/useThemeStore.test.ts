import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
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

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onThemeChanged: vi.fn(async () => () => undefined),
    setTheme: mocks.setTheme,
    theme: vi.fn(async () => 'light'),
  }),
}))

import useThemeStore, {
  FALLBACK_DARK_THEME,
  FALLBACK_LIGHT_THEME,
} from './useThemeStore'
import { STARTUP_APPEARANCE_SESSION_STORAGE_KEY } from '@/startup/appearance'

describe('theme selection preview', () => {
  beforeEach(() => {
    mocks.invoke.mockReset()
    mocks.invoke.mockImplementation(async (command: string) =>
      command === 'get_system_theme' ? 'light' : undefined,
    )
    mocks.loadThemeCss.mockClear()
    mocks.removeInsertedTheme.mockClear()
    mocks.setTheme.mockClear()
    mocks.writeSettingData.mockReset()
    mocks.writeSettingData.mockResolvedValue(undefined)
    window.sessionStorage.clear()
    useThemeStore.setState({
      darkThemeName: FALLBACK_DARK_THEME,
      lightThemeName: FALLBACK_LIGHT_THEME,
      systemTheme: 'light',
      themeMode: 'light',
    })
  })

  it('previews without persistence and restores the committed theme on cancel', () => {
    useThemeStore.getState().previewTheme({ themeMode: 'dark' })

    expect(useThemeStore.getState().curTheme.mode).toBe('dark')
    expect(useThemeStore.getState().themeMode).toBe('light')
    expect(mocks.writeSettingData).not.toHaveBeenCalled()

    useThemeStore.getState().restoreThemePreview()
    expect(useThemeStore.getState().curTheme.mode).toBe('light')
    expect(mocks.writeSettingData).not.toHaveBeenCalled()
  })

  it('persists an accent snapshot only after its config commit without reapplying the theme', async () => {
    const order: string[] = []
    let releaseConfig!: () => void
    const configCommit = new Promise<void>((resolve) => {
      releaseConfig = resolve
    })
    mocks.writeSettingData.mockImplementation(async () => {
      order.push('config:start')
      await configCommit
      order.push('config:done')
    })
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'save_startup_appearance') order.push('appearance')
      return command === 'get_system_theme' ? 'light' : undefined
    })

    const commit = useThemeStore.getState().commitAccentColor('#AbC')

    expect(order).toEqual(['config:start'])
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      'save_startup_appearance',
      expect.anything(),
    )

    releaseConfig()
    await expect(commit).resolves.toBe('native')

    expect(order).toEqual(['config:start', 'config:done', 'appearance'])
    expect(mocks.invoke).toHaveBeenCalledWith('save_startup_appearance', {
      appearance: expect.objectContaining({
        palette: expect.objectContaining({ accent: '#aabbcc' }),
        preference: 'light',
        resolvedMode: 'light',
        themeId: FALLBACK_LIGHT_THEME,
      }),
    })
    expect(mocks.loadThemeCss).not.toHaveBeenCalled()
    expect(mocks.removeInsertedTheme).not.toHaveBeenCalled()
    expect(mocks.setTheme).not.toHaveBeenCalled()
  })

  it('does not persist an accent snapshot after a failed config commit', async () => {
    mocks.writeSettingData.mockRejectedValue(new Error('config write failed'))

    await expect(useThemeStore.getState().commitAccentColor('#123456')).rejects.toThrow(
      'config write failed',
    )

    expect(mocks.invoke).not.toHaveBeenCalledWith(
      'save_startup_appearance',
      expect.anything(),
    )
    expect(mocks.loadThemeCss).not.toHaveBeenCalled()
    expect(mocks.removeInsertedTheme).not.toHaveBeenCalled()
    expect(mocks.setTheme).not.toHaveBeenCalled()
  })

  it('persists a selected theme appearance only after its config commit', async () => {
    const order: string[] = []
    let releaseConfig!: () => void
    const configCommit = new Promise<void>((resolve) => {
      releaseConfig = resolve
    })
    mocks.writeSettingData.mockImplementation(async () => {
      order.push('config:start')
      await configCommit
      order.push('config:done')
    })
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'save_startup_appearance') order.push('appearance')
      return command === 'get_system_theme' ? 'light' : undefined
    })

    useThemeStore.getState().setThemeMode('dark')

    expect(useThemeStore.getState().themeMode).toBe('dark')
    expect(useThemeStore.getState().curTheme.mode).toBe('dark')
    expect(order).toEqual(['config:start'])
    expect(
      JSON.parse(window.sessionStorage.getItem(STARTUP_APPEARANCE_SESSION_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ preference: 'dark', resolvedMode: 'dark' })

    releaseConfig()
    await vi.waitFor(() => expect(order).toEqual(['config:start', 'config:done', 'appearance']))
  })
})
