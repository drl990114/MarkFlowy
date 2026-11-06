import { checkUpdate } from '@/helper/updater'
import useAppSettingStore from '@/stores/useAppSettingStore'

export const getUpdateCheckInterval = (value: unknown): number => {
  const minutes = Number(value ?? 60)
  return [0, 60, 120, 240].includes(minutes) ? minutes * 60_000 : 3_600_000
}

export const startPeriodicUpdateChecks = (): (() => void) => {
  let timer: ReturnType<typeof setInterval> | undefined
  const schedule = () => {
    if (timer !== undefined) clearInterval(timer)
    const interval = getUpdateCheckInterval(
      useAppSettingStore.getState().settingData.update_check_interval,
    )
    if (interval) timer = setInterval(() => { void checkUpdate() }, interval)
  }
  schedule()
  const unsubscribe = useAppSettingStore.subscribe((state, previous) => {
    if (state.settingData.update_check_interval !== previous.settingData.update_check_interval) {
      schedule()
    }
  })
  return () => {
    unsubscribe()
    if (timer !== undefined) clearInterval(timer)
  }
}
