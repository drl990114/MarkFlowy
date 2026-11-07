import { beforeEach, describe, expect, it, vi } from 'vitest'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { executeZoomCommand, nextZoom, zoomInPlusShortcut } from './zoomCommands'
import { getDefaultKeybindings } from './keybindingCatalog'

const mocks = vi.hoisted(() => ({ setZoom: vi.fn(), write: vi.fn() }))
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ setZoom: mocks.setZoom }) }))
vi.mock('@/services/app-setting', () => ({ writeSettingPatch: mocks.write }))

beforeEach(() => {
  vi.clearAllMocks()
  useAppSettingStore.setState({ settingData: { webview_zoom: '1', editor_placeholder: true } })
  mocks.setZoom.mockResolvedValue(undefined)
  mocks.write.mockImplementation(async (patch) => {
    const { settingData, setSettingData } = useAppSettingStore.getState()
    setSettingData({ ...settingData, ...patch })
  })
})

describe('shared window zoom commands', () => {
  it('offers Plus only for the untouched zoom-in default', () => {
    const defaults = getDefaultKeybindings('linux')
    expect(zoomInPlusShortcut(defaults)).toBe('mod-Shift-[Equal]')
    for (const keys of [[], ['CommandOrCtrl', '[KeyJ]'], ['Alt', '[Equal]']]) {
      expect(zoomInPlusShortcut(defaults.map((binding) =>
        binding.id === 'app_zoomIn.default' ? { ...binding, keys } : binding,
      ))).toBeUndefined()
    }
  })

  it.each([
    ['CommandOrCtrl', 'Shift', '+'],
    ['CommandOrCtrl', 'Shift', '[Equal]'],
  ])('leaves explicitly owned Plus keys %j to another command', (...keys) => {
    const defaults = getDefaultKeybindings('linux')
    expect(zoomInPlusShortcut(defaults.map((binding) =>
      binding.command === 'editor_toggleStrong' ? { ...binding, keys } : binding,
    ))).toBeUndefined()
  })

  it('keeps the existing 50–200% range and exact 10% steps', () => {
    expect(nextZoom('1.2', 'app_zoomIn')).toBe(1.3)
    expect(nextZoom('2', 'app_zoomIn')).toBe(2)
    expect(nextZoom('0.5', 'app_zoomOut')).toBe(0.5)
    expect(nextZoom('broken', 'app_zoomIn')).toBe(1.1)
    expect(nextZoom('1.7', 'app_zoomReset')).toBe(1)
  })

  it('serializes rapid steps and persists only the zoom setting', async () => {
    await Promise.all([executeZoomCommand('app_zoomIn'), executeZoomCommand('app_zoomIn')])
    expect(mocks.setZoom.mock.calls).toEqual([[1.1], [1.2]])
    expect(mocks.write.mock.calls).toEqual([[{ webview_zoom: '1.1' }], [{ webview_zoom: '1.2' }]])
    expect(useAppSettingStore.getState().settingData.editor_placeholder).toBe(true)
    await executeZoomCommand('app_zoomReset')
    expect(useAppSettingStore.getState().settingData.webview_zoom).toBe('1')
  })

  it('restores the native zoom after a failed save and allows the next command', async () => {
    mocks.write.mockRejectedValueOnce(new Error('disk full'))
    await expect(executeZoomCommand('app_zoomIn')).rejects.toThrow('disk full')
    expect(mocks.setZoom.mock.calls).toEqual([[1.1], [1]])
    expect(useAppSettingStore.getState().settingData.webview_zoom).toBe('1')
    await executeZoomCommand('app_zoomOut')
    expect(useAppSettingStore.getState().settingData.webview_zoom).toBe('0.9')
  })

  it('does not persist a zoom that the webview failed to apply', async () => {
    mocks.setZoom.mockRejectedValueOnce(new Error('closed'))
    await expect(executeZoomCommand('app_zoomIn')).rejects.toThrow('closed')
    expect(mocks.write).not.toHaveBeenCalled()
  })
})
