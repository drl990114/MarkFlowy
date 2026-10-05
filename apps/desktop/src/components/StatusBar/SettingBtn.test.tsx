import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useContextMenuStore, { type IShowContextMenuParams } from '@/stores/useContextMenuStore'
import { AppMenuButton } from '../TitleBar/AppMenuButton'
import { CenterMenu } from './SettingBtn'

const settingMenuTestState = vi.hoisted(() => ({
  setThemeMode: vi.fn(),
  showContextMenu: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'about.label': 'About',
        'command_palette.title': 'Command Palette',
        'common.menu': 'Menu',
        'settings.label': 'Settings',
        'settings.display.theme.mode.system': 'System',
        'settings.display.theme.mode.light': 'Light',
        'settings.display.theme.mode.dark': 'Dark',
        'view.theme.label': 'Theme',
      })[key] ?? key,
  }),
}))

vi.mock('@/services/windows', () => ({
  currentWindow: { label: 'main' },
}))

vi.mock('@/stores/useThemeStore', () => ({
  default: () => ({ themeMode: 'system', setThemeMode: settingMenuTestState.setThemeMode }),
}))

vi.mock('@tauri-apps/api/event', () => ({ emitTo: vi.fn() }))
vi.mock('../ui-v2/ContextMenu/ContextMenu', () => ({
  showContextMenu: settingMenuTestState.showContextMenu,
}))

describe('application menu', () => {
  beforeEach(() => {
    settingMenuTestState.setThemeMode.mockReset()
    settingMenuTestState.showContextMenu.mockReset()
    useContextMenuStore.getState().hide()
    settingMenuTestState.showContextMenu.mockImplementation((params: IShowContextMenuParams) => {
      useContextMenuStore.getState().show(params)
    })
  })

  afterEach(cleanup)

  it('exposes the migrated application menu from the title bar', () => {
    render(<AppMenuButton />)
    const trigger = screen.getByRole('button', { name: 'MarkFlowy Menu' })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      bottom: 34,
      left: 76,
      right: 98,
    } as DOMRect)

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.textContent).toBe('')
    expect(trigger.hasAttribute('data-mf-status-bar-button')).toBe(false)

    fireEvent.click(trigger)

    expect(settingMenuTestState.showContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [
          expect.objectContaining({
            commandId: 'app_commandPalette',
            label: 'Command Palette',
            value: 'command-palette',
          }),
          expect.objectContaining({ label: 'About', value: 'about' }),
          expect.objectContaining({ label: 'Theme', value: 'theme' }),
          expect.objectContaining({
            commandId: 'app_openSetting',
            label: 'Settings',
            value: 'settings',
          }),
        ],
        x: 98,
        y: 38,
      }),
    )
  })

  it('keeps a discoverable settings fallback in the native Linux status bar', () => {
    render(<CenterMenu />)
    const trigger = screen.getByRole('button', { name: 'Settings' })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      bottom: 124,
      left: 12,
      right: 34,
      top: 102,
    } as DOMRect)

    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.hasAttribute('data-mf-status-bar-button')).toBe(true)

    fireEvent.click(trigger)

    expect(settingMenuTestState.showContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            commandId: 'app_commandPalette',
            label: 'Command Palette',
            value: 'command-palette',
          }),
        ]),
        x: 12,
        y: 98,
      }),
    )
  })

  it('marks only the owning menu trigger expanded until the menu closes or is replaced', () => {
    render(<CenterMenu />)
    const trigger = screen.getByRole('button', { name: 'Settings' })

    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    act(() => useContextMenuStore.getState().hide())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    act(() => {
      useContextMenuStore.getState().show({
        items: [{ label: 'Editor action', value: 'editor-action' }],
        x: 200,
        y: 200,
      })
    })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })
})
