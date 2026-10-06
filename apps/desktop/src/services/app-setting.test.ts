import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), emit: vi.fn(), consent: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/api/event', () => ({ emit: mocks.emit }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn(), debug: vi.fn(), info: vi.fn() } }))
vi.mock('@/startup/sentry', () => ({ syncErrorReportingPreference: mocks.consent }))
import useAppSettingStore from '@/stores/useAppSettingStore'
import { appSettingStoreSetup, writeSettingData, writeSettingPatch } from './app-setting'

let backend: Record<string, unknown>
const commit = (data: Record<string, unknown>) => {
  backend = { ...backend, ...data }
  return { ...backend }
}

beforeEach(() => {
  vi.clearAllMocks()
  backend = { language: 'en', theme_mode: 'light' }
  mocks.invoke.mockReset().mockImplementation(async (_command, { data }) => commit(data))
  mocks.emit.mockReset().mockResolvedValue(undefined)
  useAppSettingStore.setState({ settingData: { ...backend } })
})

describe('settings transactions', () => {
  it('opens single files in new windows by default when config loading fails', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('config unavailable'))
    const defaults = await appSettingStoreSetup()
    expect(defaults.open_file_in_new_window).toBe(true)
    expect(useAppSettingStore.getState().settingData.open_file_in_new_window).toBe(true)
  })

  it('persists disabling new windows while preserving other settings', async () => {
    await writeSettingData({ key: 'open_file_in_new_window' }, false)
    expect(mocks.invoke).toHaveBeenCalledWith('save_app_conf', {
      data: { open_file_in_new_window: false },
    })
    expect(useAppSettingStore.getState().settingData).toEqual({
      language: 'en',
      theme_mode: 'light',
      open_file_in_new_window: false,
    })
  })

  it('enables reports only after consent is saved, and a later revocation wins over queued writes', async () => {
    let release!: () => void
    mocks.invoke.mockImplementationOnce(
      (_command, { data }) =>
        new Promise((resolve) => {
          release = () => resolve(commit(data))
        }),
    )
    const enable = writeSettingPatch({ error_reporting_enabled: true })
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce())
    expect(mocks.consent).not.toHaveBeenCalled()
    const disable = writeSettingPatch({ error_reporting_enabled: false })
    expect(mocks.consent).toHaveBeenLastCalledWith(false)
    release()
    await Promise.all([enable, disable])
    expect(mocks.consent.mock.calls.every(([enabled]) => enabled === false)).toBe(true)
    await writeSettingPatch({ error_reporting_enabled: true })
    expect(mocks.consent).toHaveBeenLastCalledWith(true)
  })

  it('keeps reporting stopped if persisting a revocation fails', async () => {
    useAppSettingStore.setState({ settingData: { error_reporting_enabled: true } })
    mocks.invoke.mockRejectedValueOnce(new Error('disk full'))
    await expect(writeSettingPatch({ error_reporting_enabled: false })).rejects.toThrow('disk full')
    expect(mocks.consent.mock.calls).toEqual([[false]])
  })

  it('saves a theme identity and mode in a single config write', async () => {
    await writeSettingPatch({ light_theme: 'paper/light', theme_mode: 'light' })
    expect(mocks.invoke).toHaveBeenCalledOnce()
    expect(mocks.invoke).toHaveBeenCalledWith('save_app_conf', {
      data: { light_theme: 'paper/light', theme_mode: 'light' },
    })
  })

  it('serializes overlapping writes and merges each patch with the last committed settings', async () => {
    let release!: () => void
    mocks.invoke.mockImplementationOnce(
      (_command, { data }) =>
        new Promise((resolve) => {
          release = () => resolve(commit(data))
        }),
    )
    const theme = writeSettingPatch({ dark_theme: 'paper/dark', theme_mode: 'dark' })
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledOnce())
    const language = writeSettingData({ key: 'language' }, 'zh')
    expect(mocks.invoke).toHaveBeenCalledOnce()
    release()
    await Promise.all([theme, language])
    expect(mocks.invoke.mock.calls[1][1].data).toEqual({ language: 'zh' })
    expect(useAppSettingStore.getState().settingData).toEqual({
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
    expect(mocks.invoke.mock.calls[1][1].data).toEqual({ language: 'zh' })
  })

  it("preserves another window's saved values even when this renderer has stale settings", async () => {
    backend = {
      ...backend,
      theme_mode: 'dark',
      error_reporting_enabled: false,
      extensions_chatgpt_apikey: 'updated-key',
    }
    useAppSettingStore.setState({
      settingData: {
        language: 'en',
        theme_mode: 'light',
        error_reporting_enabled: true,
        extensions_chatgpt_apikey: 'old-key',
      },
    })
    await writeSettingPatch({ language: 'zh' })
    expect(backend).toEqual({
      language: 'zh',
      theme_mode: 'dark',
      error_reporting_enabled: false,
      extensions_chatgpt_apikey: 'updated-key',
    })
    expect(useAppSettingStore.getState().settingData).toEqual(backend)
    expect(mocks.consent).toHaveBeenLastCalledWith(false)
  })

  it('keeps a committed setting when notifying other windows fails', async () => {
    mocks.emit.mockRejectedValueOnce(new Error('window closed'))
    await writeSettingPatch({ language: 'zh' })
    expect(useAppSettingStore.getState().settingData.language).toBe('zh')
    expect(backend.language).toBe('zh')
  })

  it('does not activate a remembered dialog choice when persistence fails', async () => {
    const original = { ...backend, dialog_preferences: { close: 'save' } }
    useAppSettingStore.setState({ settingData: original })
    mocks.invoke.mockRejectedValueOnce(new Error('disk full'))
    await expect(writeSettingPatch({ dialog_preferences: { close: 'discard' } })).rejects.toThrow(
      'disk full',
    )
    expect(useAppSettingStore.getState().settingData).toEqual(original)
  })
})
