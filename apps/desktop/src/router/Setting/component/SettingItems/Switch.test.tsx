import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import SwitchSettingItem from './Switch'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/app-setting', () => ({ default: { writeSettingData: vi.fn() } }))

const item: Setting.SwitchSettingItem = {
  key: 'open_file_in_new_window',
  type: 'switch',
  defaultValue: true,
  title: { i18nKey: 'open_file_in_new_window' },
}
const initialStore = useAppSettingStore.getState()

afterEach(() => {
  cleanup()
  useAppSettingStore.setState(initialStore, true)
  vi.clearAllMocks()
})

describe('switch setting defaults', () => {
  it.each([undefined, null])('shows the enabled default for an unset value (%s)', (value) => {
    useAppSettingStore.setState({ settingData: { open_file_in_new_window: value } })
    render(<SwitchSettingItem item={item} />)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true')
    expect(appSettingService.writeSettingData).not.toHaveBeenCalled()
  })

  it('keeps a saved disabled preference and writes the next toggle', () => {
    useAppSettingStore.setState({ settingData: { open_file_in_new_window: false } })
    render(<SwitchSettingItem item={item} />)
    const control = screen.getByRole('switch', { name: 'open_file_in_new_window' })
    expect(control.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(control)
    expect(appSettingService.writeSettingData).toHaveBeenCalledWith(item, true)
  })

  it('allows disabling an inherited enabled preference', () => {
    useAppSettingStore.setState({ settingData: {} })
    render(<SwitchSettingItem item={item} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(appSettingService.writeSettingData).toHaveBeenCalledWith(item, false)
  })

  it('preserves the disabled fallback for switches without an explicit default', () => {
    useAppSettingStore.setState({ settingData: {} })
    render(<SwitchSettingItem item={{ ...item, defaultValue: undefined }} />)
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false')
  })
})
