import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { useThemeLibrary } from '@/themes/library'
import useThemeStore, { FALLBACK_DARK_THEME, FALLBACK_LIGHT_THEME } from '@/stores/useThemeStore'
import { ThemeSetting } from './index'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeStore } from '../ThemeStore'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  setTheme: vi.fn(),
  writeSettingData: vi.fn(),
  writeSettingPatch: vi.fn(),
  openUrl: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { name?: string; names?: string }) => {
      if (key === 'settings.display.theme.unavailable') return `${values?.name} (unavailable)`
      if (key === 'settings.display.theme.unavailable_help') return `Unavailable: ${values?.names}`
      return key
    },
  }),
}))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: mocks.openUrl }))
vi.mock('@/helper/extensions', () => ({
  loadThemeCss: vi.fn(),
  removeInsertedTheme: vi.fn(),
}))
vi.mock('@/services/app-setting', () => ({
  default: { writeSettingData: mocks.writeSettingData, writeSettingPatch: mocks.writeSettingPatch },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onThemeChanged: vi.fn(async () => () => undefined),
    setTheme: mocks.setTheme,
    theme: vi.fn(async () => useThemeStore.getState().systemTheme),
  }),
}))

vi.mock('../../../../../../community-themes.json', () => ({ default: [] }))
vi.mock('../ThemeStore/ThemePreview', () => ({ ThemePreview: () => null }))

const initialThemeState = useThemeStore.getState()
const initialSettingState = useAppSettingStore.getState()
const initialLibraryState = useThemeLibrary.getState()

let client: QueryClient
function ThemeSettingHarness() {
  const theme = useThemeStore((state) => state.curTheme)
  const [selection, setSelection] = useState<{ mode?: 'light' | 'dark' }>()
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme.styledConstants}>
        {selection ? (
          <ThemeStore
            mode={selection.mode}
            onBack={() => setSelection(undefined)}
            onSelected={() => setSelection(undefined)}
          />
        ) : (
          <ThemeSetting onBrowse={(mode) => setSelection({ mode })} />
        )}
      </ThemeProvider>
    </QueryClientProvider>
  )
}

const control = (key: string) => `settings.themeStore.controls.${key}`
const themeCard = (mode: 'light' | 'dark') =>
  screen.getByRole('region', {
    name: `settings.display.theme.${mode}_theme.label`,
  })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.invoke.mockImplementation(async (command: string) =>
    command === 'get_system_theme' ? 'light' : undefined,
  )
  mocks.setTheme.mockResolvedValue(undefined)
  mocks.openUrl.mockResolvedValue(undefined)
  client = new QueryClient()
  useThemeLibrary.setState({ loaded: true })
  mocks.writeSettingPatch.mockImplementation(async (patch) => {
    const { settingData, setSettingData } = useAppSettingStore.getState()
    setSettingData({ ...settingData, ...patch })
  })
  mocks.writeSettingData.mockImplementation(async ({ key }: { key: string }, value: string) => {
    const { settingData, setSettingData } = useAppSettingStore.getState()
    setSettingData({ ...settingData, [key]: value })
  })
  useAppSettingStore.setState({ settingData: {} })
  useThemeStore.setState({
    ...initialThemeState,
    darkThemeName: FALLBACK_DARK_THEME,
    lightThemeName: FALLBACK_LIGHT_THEME,
    systemTheme: 'light',
    themeMode: 'system',
  })
  useThemeStore.getState().applyTheme(false)
  mocks.setTheme.mockClear()
})

afterEach(async () => {
  cleanup()
  client.clear()
  await act(async () => {})
  useThemeStore.setState(initialThemeState, true)
  useAppSettingStore.setState(initialSettingState, true)
  useThemeLibrary.setState(initialLibraryState, true)
  window.sessionStorage.clear()
})

describe('appearance theme selection', () => {
  it('explains unavailable selections without replacing their saved identity', async () => {
    useThemeLibrary.setState({ loaded: false })
    useAppSettingStore.setState({ settingData: { language: 'zh-CN', light_theme: 'legacy-paper' } })
    useThemeStore.setState({ lightThemeName: 'legacy-paper' })
    useThemeStore.getState().applyTheme(false)
    render(<ThemeSettingHarness />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_LIGHT_THEME)

    act(() => useThemeLibrary.setState({ loaded: true }))
    expect(screen.getByRole('status').textContent).toContain('legacy-paper')
    expect(themeCard('light').textContent).toContain('legacy-paper (unavailable)')
    expect(useAppSettingStore.getState().settingData.light_theme).toBe('legacy-paper')
    fireEvent.click(screen.getByRole('button', { name: 'settings.display.theme.migration_guide' }))
    expect(mocks.openUrl).toHaveBeenCalledWith(
      'https://www.markflowy.cc/zh/docs/Extension/CustomTheme',
    )

    act(() => {
      const state = useThemeStore.getState()
      const restored = {
        ...state.themes.find((theme) => theme.name === FALLBACK_LIGHT_THEME)!,
        name: 'legacy-paper',
      }
      useThemeStore.setState({ themes: [...state.themes, restored] })
      useThemeStore.getState().applyTheme(false)
    })
    expect(screen.queryByRole('status')).toBeNull()
    expect(useThemeStore.getState().curTheme.name).toBe('legacy-paper')
    expect(mocks.writeSettingData).not.toHaveBeenCalled()
  })

  it('shows both choices in fixed mode and opens the matching library without changing appearance', () => {
    useThemeStore.setState({ themeMode: 'light' })
    render(<ThemeSettingHarness />)
    expect(themeCard('light')).toBeTruthy()
    expect(themeCard('dark')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: control('changeDark') }))
    expect(screen.getByRole('heading', { name: control('chooseDark') })).toBeTruthy()
    expect(screen.getByRole('article', { name: 'GitHub Dark' })).toBeTruthy()
    expect(screen.queryByRole('article', { name: 'GitHub Light' })).toBeNull()
    expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_LIGHT_THEME)
    expect(mocks.setTheme).not.toHaveBeenCalled()
    expect(mocks.writeSettingPatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: control('backToAppearance') }))
    expect(themeCard('dark')).toBeTruthy()
  })

  it.each([
    { current: 'light', next: 'dark', name: 'GitHub Dark', key: 'dark_theme', action: 'setDark' },
    {
      current: 'dark',
      next: 'light',
      name: 'GitHub Light',
      key: 'light_theme',
      action: 'setLight',
    },
  ] as const)(
    'keeps system mode when selecting $next, then uses it on an OS appearance change',
    async ({ current, next, name, key, action }) => {
      useThemeStore.setState({ systemTheme: current })
      useThemeStore.getState().applyTheme(false)
      const before = useThemeStore.getState().curTheme.name
      render(<ThemeSettingHarness />)
      fireEvent.click(
        screen.getByRole('button', {
          name: control(next === 'light' ? 'changeLight' : 'changeDark'),
        }),
      )
      fireEvent.click(
        within(screen.getByRole('article', { name })).getByRole('button', {
          name: control(action),
        }),
      )
      await waitFor(() => expect(themeCard(next).textContent).toContain(name))
      expect(useThemeStore.getState()).toMatchObject({
        themeMode: 'system',
        curTheme: { name: before },
      })
      expect(mocks.writeSettingPatch).toHaveBeenCalledExactlyOnceWith({ [key]: name })
      expect(within(themeCard(next)).queryByText(control('active'))).toBeNull()
      expect(themeCard(next).textContent).toContain(
        control(next === 'light' ? 'useInLight' : 'useInDark'),
      )
      await act(async () => useThemeStore.getState().setSystemTheme(next))
      expect(useThemeStore.getState()).toMatchObject({ themeMode: 'system', curTheme: { name } })
      expect(within(themeCard(next)).getByText(control('active'))).toBeTruthy()
    },
  )

  it.each(['light', 'dark'] as const)(
    'preserves fixed %s mode when changing the other theme',
    async (mode) => {
      useThemeStore.setState({ themeMode: mode })
      useThemeStore.getState().applyTheme(false)
      const before = useThemeStore.getState().curTheme.name
      const next = mode === 'light' ? 'dark' : 'light'
      const name = next === 'dark' ? 'GitHub Dark' : 'GitHub Light'
      render(<ThemeSettingHarness />)
      fireEvent.click(
        screen.getByRole('button', {
          name: control(next === 'light' ? 'changeLight' : 'changeDark'),
        }),
      )
      fireEvent.click(
        within(screen.getByRole('article', { name })).getByRole('button', {
          name: control(next === 'light' ? 'setLight' : 'setDark'),
        }),
      )
      await waitFor(() => expect(themeCard(next).textContent).toContain(name))
      expect(useThemeStore.getState()).toMatchObject({
        themeMode: mode,
        curTheme: { name: before },
      })
      expect(mocks.writeSettingPatch).toHaveBeenCalledExactlyOnceWith({ [`${next}_theme`]: name })
    },
  )

  it('only changes the display mode when its mode control is selected', async () => {
    render(<ThemeSettingHarness />)
    fireEvent.click(screen.getByRole('radio', { name: 'settings.display.theme.mode.dark' }))
    expect(useThemeStore.getState()).toMatchObject({
      themeMode: 'dark',
      curTheme: { mode: 'dark' },
    })
    expect(mocks.writeSettingData).toHaveBeenCalledExactlyOnceWith({ key: 'theme_mode' }, 'dark')
    expect(mocks.writeSettingPatch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('radio', { name: 'settings.display.theme.mode.system' }))
    await waitFor(() =>
      expect(useThemeStore.getState()).toMatchObject({
        themeMode: 'system',
        curTheme: { mode: 'light' },
      }),
    )
  })

  it('applies the chosen active-mode theme immediately without leaving system mode', async () => {
    render(<ThemeSettingHarness />)
    fireEvent.click(screen.getByRole('button', { name: control('changeLight') }))
    fireEvent.click(
      within(screen.getByRole('article', { name: 'GitHub Light' })).getByRole('button', {
        name: control('setLight'),
      }),
    )
    await waitFor(() => expect(themeCard('light').textContent).toContain('GitHub Light'))
    expect(useThemeStore.getState()).toMatchObject({
      themeMode: 'system',
      curTheme: { name: 'GitHub Light' },
    })
    expect(within(themeCard('light')).getByText(control('active'))).toBeTruthy()
    expect(mocks.writeSettingPatch).toHaveBeenCalledExactlyOnceWith({ light_theme: 'GitHub Light' })
  })

  it('lets the user replace an unavailable selection with the currently rendered fallback', async () => {
    useAppSettingStore.setState({ settingData: { light_theme: 'missing' } })
    useThemeStore.setState({ lightThemeName: 'missing' })
    useThemeStore.getState().applyTheme(false)
    render(<ThemeSettingHarness />)
    fireEvent.click(screen.getByRole('button', { name: control('changeLight') }))
    fireEvent.click(
      within(screen.getByRole('article', { name: FALLBACK_LIGHT_THEME })).getByRole('button', {
        name: control('setLight'),
      }),
    )
    await waitFor(() => expect(themeCard('light').textContent).toContain(FALLBACK_LIGHT_THEME))
    expect(screen.queryByRole('status')).toBeNull()
    expect(mocks.writeSettingPatch).toHaveBeenCalledExactlyOnceWith({
      light_theme: FALLBACK_LIGHT_THEME,
    })
  })

  it('keeps the chooser open and rolls back a failed setting write', async () => {
    mocks.writeSettingPatch.mockRejectedValue(new Error('disk full'))
    render(<ThemeSettingHarness />)
    fireEvent.click(screen.getByRole('button', { name: control('changeDark') }))
    fireEvent.click(
      within(screen.getByRole('article', { name: 'GitHub Dark' })).getByRole('button', {
        name: control('setDark'),
      }),
    )
    expect((await screen.findByRole('alert')).textContent).toContain('disk full')
    expect(useThemeStore.getState()).toMatchObject({
      themeMode: 'system',
      darkThemeName: FALLBACK_DARK_THEME,
      curTheme: { name: FALLBACK_LIGHT_THEME },
    })
    expect(screen.getByRole('heading', { name: control('chooseDark') })).toBeTruthy()
  })
})
