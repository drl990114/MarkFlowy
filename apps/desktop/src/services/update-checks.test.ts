import { afterEach, describe, expect, it, vi } from 'vitest'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { checkUpdate } from '@/helper/updater'
import { getUpdateCheckInterval, startPeriodicUpdateChecks } from './update-checks'

vi.mock('@/helper/updater', () => ({ checkUpdate: vi.fn().mockResolvedValue(undefined) }))
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('periodic update checks', () => {
  it('defaults to hourly checks and stops when disposed', async () => {
    vi.useFakeTimers()
    useAppSettingStore.setState({ settingData: {} })
    const stop = startPeriodicUpdateChecks()
    await vi.advanceTimersByTimeAsync(3_599_999)
    expect(checkUpdate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(checkUpdate).toHaveBeenCalledOnce()
    stop()
    await vi.advanceTimersByTimeAsync(7_200_000)
    expect(checkUpdate).toHaveBeenCalledOnce()
  })

  it('reschedules saved preferences and supports startup-only checks', async () => {
    vi.useFakeTimers()
    useAppSettingStore.setState({ settingData: {} })
    const stop = startPeriodicUpdateChecks()
    useAppSettingStore.setState({ settingData: { update_check_interval: '120' } })
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(checkUpdate).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(3_600_000)
    expect(checkUpdate).toHaveBeenCalledOnce()
    useAppSettingStore.setState({ settingData: { update_check_interval: '0' } })
    await vi.advanceTimersByTimeAsync(14_400_000)
    expect(checkUpdate).toHaveBeenCalledOnce()
    stop()
  })

  it('uses the default for invalid saved values', () => {
    expect(getUpdateCheckInterval('invalid')).toBe(3_600_000)
    expect(getUpdateCheckInterval('-1')).toBe(3_600_000)
  })
})
