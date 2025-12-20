import useAppSettingStore from '@/stores/useAppSettingStore'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'

export const appSettingStoreSetup = async () => {
  const { setSettingData } = useAppSettingStore.getState()

  const settingData = await invoke<Record<string, any>>('get_app_conf')

  setSettingData(settingData)

  return settingData
}

export const writeSettingData = async (item: Pick<Setting.SettingItem, 'key'>, value: any) => {
  const { settingData } = useAppSettingStore.getState()

  const newSettingData = {
    ...settingData,
    [item.key]: value,
  }

  await invoke('save_app_conf', { data: newSettingData, label: 'markflowy' })

  emit('app_conf_change')
}

const appSettingService = {
  appSettingStoreSetup,
  writeSettingData,
}

export default appSettingService
