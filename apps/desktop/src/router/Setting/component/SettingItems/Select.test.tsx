import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useLayoutStore, { DOCK_PREFERENCES_STORAGE_KEY } from '@/stores/useLayoutStore'
import useAppSettingStore from '@/stores/useAppSettingStore'
import appSettingService from '@/services/app-setting'
import SelectSettingItem from './Select'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/app-setting', () => ({ default: { writeSettingData: vi.fn() } }))

const initialLayout = useLayoutStore.getState()
afterEach(() => {
  cleanup()
  useLayoutStore.setState(initialLayout, true)
  localStorage.clear()
  vi.clearAllMocks()
})

describe('startup panel setting', () => {
  it('persists the selection in layout preferences and applies it on the next launch', async () => {
    const settingsBefore = useAppSettingStore.getState().settingData
    useLayoutStore.setState({
      leftStartup: 'restore',
      leftBar: { activePanelId: 'explorer', visible: false, size: 310 },
    })
    render(
      <SelectSettingItem
        item={{
          key: 'leftStartup',
          type: 'select',
          storage: 'layout',
          title: { i18nKey: 'startup.left' },
          options: [
            { value: 'restore', title: 'Restore' },
            { value: 'search', title: 'Search' },
          ],
        }}
      />,
    )
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'startup.left' }), { key: 'Enter' })
    fireEvent.click(await screen.findByRole('option', { name: 'Search' }))
    expect(useLayoutStore.getState()).toMatchObject({
      leftStartup: 'search',
      leftBar: { activePanelId: 'explorer', visible: false, size: 310 },
    })
    expect(JSON.parse(localStorage.getItem(DOCK_PREFERENCES_STORAGE_KEY)!)).toMatchObject({
      state: { leftStartup: 'search' },
    })
    expect(appSettingService.writeSettingData).not.toHaveBeenCalled()
    expect(useAppSettingStore.getState().settingData).toBe(settingsBefore)
    await act(async () => {
      await useLayoutStore.persist.rehydrate()
    })
    expect(useLayoutStore.getState().leftBar).toEqual({
      activePanelId: 'search',
      visible: true,
      size: 310,
    })
  })
})
