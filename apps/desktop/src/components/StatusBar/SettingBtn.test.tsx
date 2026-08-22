import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  })

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
      expect.objectContaining({ x: 12, y: 98 }),
    )
  })
})
