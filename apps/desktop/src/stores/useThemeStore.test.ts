import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  loadThemeCss: vi.fn(),
  removeInsertedTheme: vi.fn(),
  setTheme: vi.fn(),
  theme: vi.fn(async () => 'light'),
  writeSettingData: vi.fn(),
  writeSettingPatch: vi.fn(),
}))

vi.mock('@/helper/extensions', () => ({
  loadThemeCss: mocks.loadThemeCss,
  removeInsertedTheme: mocks.removeInsertedTheme,
}))

vi.mock('@/services/app-setting', () => ({
  default: { writeSettingData: mocks.writeSettingData, writeSettingPatch: mocks.writeSettingPatch },
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onThemeChanged: vi.fn(async () => () => undefined),
    setTheme: mocks.setTheme,
    theme: mocks.theme,
  }),
}))

import useThemeStore, { FALLBACK_DARK_THEME, FALLBACK_LIGHT_THEME } from './useThemeStore'
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
    mocks.theme.mockReset().mockResolvedValue('light')
    mocks.writeSettingData.mockReset()
    mocks.writeSettingData.mockResolvedValue(undefined)
    mocks.writeSettingPatch.mockReset().mockResolvedValue(undefined)
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

  it('commits the selected theme and mode together before persisting appearance', async () => {
    let release!: () => void
    mocks.writeSettingPatch.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const result = useThemeStore
      .getState()
      .applyThemeSelection({ darkThemeName: FALLBACK_DARK_THEME, themeMode: 'dark' })
    await Promise.resolve()
    expect(useThemeStore.getState().curTheme.mode).toBe('dark')
    expect(mocks.writeSettingPatch).toHaveBeenCalledOnce()
    expect(mocks.writeSettingPatch).toHaveBeenCalledWith({
      dark_theme: FALLBACK_DARK_THEME,
      theme_mode: 'dark',
    })
    expect(mocks.invoke).not.toHaveBeenCalledWith('save_startup_appearance', expect.anything())
    release()
    await result
    expect(mocks.invoke).toHaveBeenCalledWith('save_startup_appearance', {
      appearance: expect.objectContaining({ preference: 'dark', themeId: FALLBACK_DARK_THEME }),
    })
  })

  it('restores the previous selection and cached appearance when the config commit fails', async () => {
    mocks.writeSettingPatch.mockRejectedValueOnce(new Error('disk full'))
    await expect(
      useThemeStore.getState().applyThemeSelection({ themeMode: 'dark' }),
    ).rejects.toThrow('disk full')
    expect(useThemeStore.getState().themeMode).toBe('light')
    expect(useThemeStore.getState().curTheme.mode).toBe('light')
    expect(
      JSON.parse(window.sessionStorage.getItem(STARTUP_APPEARANCE_SESSION_STORAGE_KEY) ?? '{}'),
    ).toMatchObject({ preference: 'light', resolvedMode: 'light' })
    expect(mocks.invoke).not.toHaveBeenCalledWith('save_startup_appearance', expect.anything())
  })

  it('does not restore another failed optimistic selection when queued actions both fail', async () => {
    mocks.writeSettingPatch.mockRejectedValue(new Error('disk full'))
    const first = useThemeStore.getState().applyThemeSelection({ themeMode: 'dark' })
    const second = useThemeStore
      .getState()
      .applyThemeSelection({ darkThemeName: 'missing/dark', themeMode: 'dark' })
    const results = await Promise.allSettled([first, second])
    expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected'])
    expect(useThemeStore.getState().themeMode).toBe('light')
    expect(useThemeStore.getState().darkThemeName).toBe(FALLBACK_DARK_THEME)
    expect(useThemeStore.getState().curTheme.mode).toBe('light')
  })

  it('uses the bootstrap system appearance during settings initialization without another theme query', async () => {
    await useThemeStore.getState().initFromSettings({ theme_mode: 'system' })
    expect(mocks.theme).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalledWith('get_system_theme')
  })

  it('coalesces concurrent theme reads and does not overwrite a newer system event', async () => {
    useThemeStore.setState({ themeMode: 'system', systemTheme: 'light' })
    let resolve!: (theme: string) => void
    mocks.theme.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done
      }),
    )
    const first = useThemeStore.getState().syncSystemTheme()
    const second = useThemeStore.getState().syncSystemTheme()
    expect(first).toBe(second)
    expect(mocks.theme).toHaveBeenCalledOnce()
    useThemeStore.getState().setSystemTheme('dark')
    resolve('light')
    await expect(first).resolves.toBe('dark')
    expect(useThemeStore.getState().systemTheme).toBe('dark')
    await useThemeStore.getState().syncSystemTheme()
    expect(mocks.theme).toHaveBeenCalledTimes(2)
    expect(useThemeStore.getState().systemTheme).toBe('light')
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
    expect(mocks.invoke).not.toHaveBeenCalledWith('save_startup_appearance', expect.anything())

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

    expect(mocks.invoke).not.toHaveBeenCalledWith('save_startup_appearance', expect.anything())
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
