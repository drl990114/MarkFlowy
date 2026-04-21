import { logger } from '@/helper/logger'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'

export const appSettingStoreSetup = async () => {
  const { setSettingData } = useAppSettingStore.getState()

  try {
    logger.debug('Invoking get_app_conf...')
    const settingData = await invoke<Record<string, any>>('get_app_conf')
    logger.info('Loaded app setting data:', settingData)
    setSettingData(settingData)
    return settingData
  } catch (error) {
    logger.error('Failed to load app setting:', error)
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    const defaultSetting = {
      theme: 'light',
      language: 'en',
      webview_zoom: '1.0',
      auto_update: false,
    }
    setSettingData(defaultSetting)
    return defaultSetting
  }
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
