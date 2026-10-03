import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { useThemeLibrary } from '@/themes/library'
import useThemeStore, { FALLBACK_DARK_THEME, FALLBACK_LIGHT_THEME } from '@/stores/useThemeStore'
import { ThemeSetting } from './index'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  setTheme: vi.fn(),
  writeSettingData: vi.fn(),
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

const initialThemeState = useThemeStore.getState()
const initialSettingState = useAppSettingStore.getState()
const initialLibraryState = useThemeLibrary.getState()

function ThemeSettingHarness({ revealedSettingKey }: { revealedSettingKey?: string }) {
  const theme = useThemeStore((state) => state.curTheme)
  return (
    <ThemeProvider theme={theme.styledConstants}>
      <ThemeSetting revealedSettingKey={revealedSettingKey} />
    </ThemeProvider>
  )
}

async function openSelect(kind: 'mode' | 'light' | 'dark', method = 'keyboard') {
  const label = kind === 'mode' ? 'mode' : `${kind}_theme`
  const trigger = screen.getByRole('combobox', {
    name: `settings.display.theme.${label}.label`,
  })
  if (method === 'mouse') {
    // happy-dom does not implement pointer capture.
    trigger.hasPointerCapture = () => false
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  } else {
    fireEvent.keyDown(trigger, { key: 'Enter' })
  }
  const content = await screen.findByRole('listbox')
  await waitFor(() => expect(document.activeElement?.getAttribute('role')).toBe('option'))
  return content
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.invoke.mockImplementation(async (command: string) =>
    command === 'get_system_theme' ? 'light' : undefined,
  )
  mocks.setTheme.mockResolvedValue(undefined)
  mocks.openUrl.mockResolvedValue(undefined)
  useThemeLibrary.setState({ loaded: false })
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
  await act(async () => {})
  useThemeStore.setState(initialThemeState, true)
  useAppSettingStore.setState(initialSettingState, true)
  useThemeLibrary.setState(initialLibraryState, true)
  window.sessionStorage.clear()
})

describe('theme selection preview interactions', () => {
  it('explains a missing selection after loading and restores it when the theme returns', async () => {
    useAppSettingStore.setState({ settingData: { language: 'zh-CN', light_theme: 'legacy-paper' } })
    useThemeStore.setState({ lightThemeName: 'legacy-paper' })
    useThemeStore.getState().applyTheme(false)
    render(<ThemeSettingHarness />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_LIGHT_THEME)

    act(() => useThemeLibrary.setState({ loaded: true }))
    expect(screen.getByRole('status').textContent).toContain('legacy-paper')
    expect(
      screen.getByRole('combobox', { name: 'settings.display.theme.light_theme.label' })
        .textContent,
    ).toContain('legacy-paper (unavailable)')
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

  it.each(['mouse', 'keyboard'])(
    'keeps the light appearance when opening dark themes with %s',
    async (method) => {
      render(<ThemeSettingHarness />)

      const content = await openSelect('dark', method)

      expect(document.activeElement?.textContent).toBe(FALLBACK_DARK_THEME)
      expect(useThemeStore.getState().curTheme.mode).toBe('light')
      expect(mocks.setTheme).not.toHaveBeenCalled()
      expect(mocks.writeSettingData).not.toHaveBeenCalled()

      fireEvent.keyDown(content, { key: 'Escape' })
      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
      expect(useThemeStore.getState().curTheme.mode).toBe('light')
      expect(mocks.setTheme).not.toHaveBeenCalled()
    },
  )

  it('keeps the dark appearance when opening light themes', async () => {
    useThemeStore.setState({ systemTheme: 'dark' })
    useThemeStore.getState().applyTheme(false)
    mocks.setTheme.mockClear()
    render(<ThemeSettingHarness />)

    await openSelect('light', 'mouse')

    expect(document.activeElement?.textContent).toBe(FALLBACK_LIGHT_THEME)
    expect(useThemeStore.getState().curTheme.mode).toBe('dark')
    expect(mocks.setTheme).not.toHaveBeenCalled()
  })

  it('does not preview a search-revealed inactive theme when opening the menu', async () => {
    useThemeStore.setState({ themeMode: 'light' })
    render(<ThemeSettingHarness revealedSettingKey='dark_theme' />)

    await openSelect('dark')

    expect(useThemeStore.getState().curTheme.mode).toBe('light')
    expect(mocks.setTheme).not.toHaveBeenCalled()
  })

  it('previews mouse movement onto the already focused item without reapplying on every move', async () => {
    render(<ThemeSettingHarness />)
    const content = await openSelect('dark')
    const selected = screen.getByRole('option', { name: FALLBACK_DARK_THEME })

    fireEvent.pointerMove(selected, { pointerType: 'mouse', clientY: 10 })

    expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_DARK_THEME)
    expect(useThemeStore.getState().themeMode).toBe('system')
    expect(mocks.setTheme).toHaveBeenCalledTimes(1)
    fireEvent.pointerMove(selected, { pointerType: 'mouse', clientY: 11 })
    expect(mocks.setTheme).toHaveBeenCalledTimes(1)

    fireEvent.pointerMove(screen.getByRole('option', { name: 'GitHub Dark' }), {
      pointerType: 'mouse',
    })
    expect(useThemeStore.getState().curTheme.name).toBe('GitHub Dark')
    fireEvent.pointerMove(selected, { pointerType: 'mouse' })
    expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_DARK_THEME)
    expect(mocks.writeSettingData).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalledWith('save_startup_appearance', expect.anything())

    fireEvent.keyDown(content, { key: 'Escape' })
    await waitFor(() => expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_LIGHT_THEME))
    expect(mocks.writeSettingData).not.toHaveBeenCalled()
  })

  it.each([
    { key: 'ArrowDown', theme: 'GitHub Dark' },
    { key: 'End', theme: 'Nord' },
    { key: 'n', theme: 'Nord' },
  ])('previews keyboard navigation with $key and restores on Escape', async ({ key, theme }) => {
    render(<ThemeSettingHarness />)
    const content = await openSelect('dark')

    fireEvent.keyDown(document.activeElement!, { key })

    await waitFor(() => expect(useThemeStore.getState().curTheme.name).toBe(theme))
    expect(document.activeElement?.textContent).toBe(theme)
    expect(useThemeStore.getState().darkThemeName).toBe(FALLBACK_DARK_THEME)
    expect(mocks.writeSettingData).not.toHaveBeenCalled()

    fireEvent.keyDown(content, { key: 'Escape' })
    await waitFor(() => expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_LIGHT_THEME))
  })

  it('saves the chosen inactive theme while restoring the current system appearance', async () => {
    render(<ThemeSettingHarness />)
    await openSelect('dark')
    const option = screen.getByRole('option', { name: 'GitHub Dark' })
    fireEvent.pointerMove(option, { pointerType: 'mouse' })
    expect(useThemeStore.getState().curTheme.name).toBe('GitHub Dark')

    fireEvent.pointerUp(option, { pointerType: 'mouse' })

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(useThemeStore.getState()).toMatchObject({
      curTheme: { name: FALLBACK_LIGHT_THEME },
      darkThemeName: 'GitHub Dark',
      themeMode: 'system',
    })
    expect(mocks.writeSettingData).toHaveBeenCalledExactlyOnceWith(
      { key: 'dark_theme' },
      'GitHub Dark',
    )
  })

  it('keeps a committed mode after keyboard preview and selection', async () => {
    render(<ThemeSettingHarness />)
    await openSelect('mode')
    expect(mocks.setTheme).not.toHaveBeenCalled()

    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    await waitFor(() => expect(useThemeStore.getState().curTheme.mode).toBe('dark'))
    expect(useThemeStore.getState().themeMode).toBe('system')
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' })

    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(useThemeStore.getState()).toMatchObject({
      curTheme: { mode: 'dark' },
      themeMode: 'dark',
    })
    expect(mocks.writeSettingData).toHaveBeenCalledExactlyOnceWith({ key: 'theme_mode' }, 'dark')
  })

  it('requires a new interaction after dismissing and reopening the menu', async () => {
    render(<ThemeSettingHarness />)
    const content = await openSelect('dark')
    fireEvent.pointerMove(screen.getByRole('option', { name: 'GitHub Dark' }), {
      pointerType: 'mouse',
    })
    fireEvent.keyDown(content, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    mocks.setTheme.mockClear()

    await openSelect('dark')

    expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_LIGHT_THEME)
    expect(mocks.setTheme).not.toHaveBeenCalled()
  })

  it.each(['outside click', 'unmount'])(
    'restores an uncommitted preview on %s',
    async (dismissal) => {
      const view = render(<ThemeSettingHarness />)
      await openSelect('dark')
      fireEvent.pointerMove(screen.getByRole('option', { name: 'Nord' }), {
        pointerType: 'mouse',
      })
      expect(useThemeStore.getState().curTheme.name).toBe('Nord')

      if (dismissal === 'unmount') {
        view.unmount()
      } else {
        fireEvent.pointerDown(document.body, { button: 0, pointerType: 'mouse' })
      }

      await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
      expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_LIGHT_THEME)
      expect(mocks.writeSettingData).not.toHaveBeenCalled()
    },
  )

  it('does not start a preview for touch scrolling', async () => {
    render(<ThemeSettingHarness />)
    await openSelect('dark')
    fireEvent.pointerMove(screen.getByRole('option', { name: 'Nord' }), {
      pointerType: 'touch',
    })

    expect(useThemeStore.getState().curTheme.name).toBe(FALLBACK_LIGHT_THEME)
    expect(mocks.setTheme).not.toHaveBeenCalled()
  })
})
