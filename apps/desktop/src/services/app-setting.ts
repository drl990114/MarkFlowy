import useAppSettingStore from '@/stores/useAppSettingStore'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'

export const appSettingStoreSetup = async () => {
  const { setSettingData } = useAppSettingStore.getState()

  const settingData = await invoke<Record<string, any>>('get_app_conf')

  console.log('Loaded app setting data:', settingData)

  setSettingData(settingData)

  return settingData
}

export const writeSettingData = async (item: Pick<Setting.SettingItem, 'key' | 'afterWrite'>, value: any) => {
  const { settingData } = useAppSettingStore.getState()

  const newSettingData = {
    ...settingData,
    [item.key]: value,
  }

  await invoke('save_app_conf', { data: newSettingData, label: 'markflowy' })

  emit('app_conf_change')

  if (item.afterWrite) {
    item.afterWrite(value)
  }
}

const appSettingService = {
  appSettingStoreSetup,
  writeSettingData,
}

export default appSettingService
