import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SliderProps } from '@/components/ui/slider'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import SliderSettingItem from './Slider'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/app-setting', () => ({ default: { writeSettingData: vi.fn() } }))
vi.mock('@/components/ui/slider', () => ({
  Slider: ({ value, onValueChange, min, max, step, 'aria-label': label }: SliderProps) => (
    <input
      type='range'
      aria-label={label}
      aria-valuenow={value}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onValueChange?.(Number(event.target.value))}
    />
  ),
  RangeSlider: () => null,
}))

const item: Setting.SliderSettingItem = {
  key: 'editor_code_font_size',
  type: 'slider',
  title: { i18nKey: 'code.font_size' },
  optionalValue: { initial: 14 },
  scope: [12, 40],
}

const initialStore = useAppSettingStore.getState()

beforeEach(() => {
  vi.mocked(appSettingService.writeSettingData).mockImplementation(async (setting, value) => {
    const store = useAppSettingStore.getState()
    store.setSettingData({ ...store.settingData, [setting.key]: value })
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  useAppSettingStore.setState(initialStore, true)
  vi.clearAllMocks()
})

const selectMode = async (mode: 'default' | 'custom') => {
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
  fireEvent.click(await screen.findByRole('option', {
    name: `settings.editor.code_editing.${mode}`,
  }))
}

describe('optional typography setting', () => {
  it('keeps the inherited value unset until the user selects custom', async () => {
    useAppSettingStore.setState({ settingData: { editor_code_font_size: null } })
    render(<SliderSettingItem item={item} />)
    expect(screen.queryByRole('slider')).toBeNull()
    expect(appSettingService.writeSettingData).not.toHaveBeenCalled()
    await selectMode('custom')
    expect(appSettingService.writeSettingData).toHaveBeenLastCalledWith(item, 14)
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('14')
    await selectMode('default')
    expect(appSettingService.writeSettingData).toHaveBeenLastCalledWith(item, null)
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('cancels a pending slider write when restoring the inherited value', async () => {
    useAppSettingStore.setState({ settingData: { editor_code_font_size: 18 } })
    const { unmount } = render(<SliderSettingItem item={item} />)
    // A drag can have pending changes before the slider commits on pointer-up.
    fireEvent.change(screen.getByRole('slider'), { target: { value: '19' } })
    expect(appSettingService.writeSettingData).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('option', {
      name: 'settings.editor.code_editing.default',
    }))
    expect(appSettingService.writeSettingData).toHaveBeenLastCalledWith(item, null)
    unmount()
    expect(useAppSettingStore.getState().settingData.editor_code_font_size).toBeNull()
  })

  it('stores custom line height as a string and restores it with a real null', async () => {
    const lineHeight = {
      ...item,
      key: 'editor_code_line_height',
      saveToString: true,
      optionalValue: { initial: 1.6 },
      scope: [1, 2] as [number, number],
      step: 0.1,
    }
    useAppSettingStore.setState({ settingData: {} })
    render(<SliderSettingItem item={lineHeight} />)
    await selectMode('custom')
    expect(appSettingService.writeSettingData).toHaveBeenLastCalledWith(lineHeight, '1.6')
    await act(async () => {
      useAppSettingStore.getState().setSettingData({ editor_code_line_height: '1.9' })
    })
    expect(screen.getByRole('slider').getAttribute('aria-valuenow')).toBe('1.9')
    await selectMode('default')
    expect(appSettingService.writeSettingData).toHaveBeenLastCalledWith(lineHeight, null)
  })
})
