import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), emit: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ emit: mocks.emit }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
import useAppSettingStore from '@/stores/useAppSettingStore'
import { writeSettingData, writeSettingPatch } from './app-setting'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.invoke.mockResolvedValue(undefined)
  useAppSettingStore.setState({ settingData: { language: 'en', theme_mode: 'light' } })
})

describe('settings transactions', () => {
  it('saves a theme identity and mode in a single config write', async () => {
    await writeSettingPatch({ light_theme: 'paper/light', theme_mode: 'light' })
    expect(mocks.invoke).toHaveBeenCalledOnce()
    expect(mocks.invoke).toHaveBeenCalledWith('save_app_conf', {
      data: { language: 'en', light_theme: 'paper/light', theme_mode: 'light' },
      label: 'markflowy',
    })
  })

  it('serializes overlapping writes and merges each patch with the last committed settings', async () => {
    let release!: () => void
    mocks.invoke.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve
        }),
    )
    const theme = writeSettingPatch({ dark_theme: 'paper/dark', theme_mode: 'dark' })
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce())
    const language = writeSettingData({ key: 'language' }, 'zh')
    expect(mocks.invoke).toHaveBeenCalledOnce()
    release()
    await Promise.all([theme, language])
    expect(mocks.invoke.mock.calls[1][1].data).toEqual({
      language: 'zh',
      dark_theme: 'paper/dark',
      theme_mode: 'dark',
    })
  })

  it('rolls back a rejected write before applying the next patch', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('disk full'))
    const failed = writeSettingPatch({ theme_mode: 'dark' })
    const next = writeSettingPatch({ language: 'zh' })
    await expect(failed).rejects.toThrow('disk full')
    await next
    expect(useAppSettingStore.getState().settingData).toEqual({
      language: 'zh',
      theme_mode: 'light',
    })
    expect(mocks.invoke.mock.calls[1][1].data).toEqual({ language: 'zh', theme_mode: 'light' })
  })
})
