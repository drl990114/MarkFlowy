import { logger } from '@/helper/logger'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { syncErrorReportingPreference } from '@/startup/sentry'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'

let errorReportingPreferenceRevision = 0
let errorReportingRevoked = false

export const appSettingStoreSetup = async () => {
  const { setSettingData } = useAppSettingStore.getState()

  try {
    logger.debug('Invoking get_app_conf...')
    const settingData = await invoke<Record<string, any>>('get_app_conf')
    logger.info('Loaded app settings')
    setSettingData(settingData)
    syncErrorReportingPreference(settingData.error_reporting_enabled === true && !errorReportingRevoked)
    return settingData
  } catch (error) {
    logger.error('Failed to load app setting:', error)
    logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    const defaultSetting = {
      theme: 'light',
      theme_accent_color: 'system',
      language: 'en',
      webview_zoom: '1.0',
      auto_update: false,
    }
    setSettingData(defaultSetting)
    syncErrorReportingPreference(false)
    return defaultSetting
  }
}

let settingWriteQueue: Promise<void> = Promise.resolve()

/** Commit related settings together and serialize whole-config writes. */
export const writeSettingPatch = (patch: Record<string, unknown>): Promise<void> => {
  const changesErrorReporting = Object.hasOwn(patch, 'error_reporting_enabled')
  const preferenceRevision = changesErrorReporting ? ++errorReportingPreferenceRevision : undefined
  // Revocation takes effect even while an earlier settings write is pending.
  if (patch.error_reporting_enabled === false) {
    errorReportingRevoked = true
    syncErrorReportingPreference(false)
  }
  const write = settingWriteQueue.then(async () => {
    const { settingData, setSettingData } = useAppSettingStore.getState()

    const newSettingData = {
      ...settingData,
      ...patch,
    }

    setSettingData(newSettingData)

    try {
      await invoke('save_app_conf', { data: newSettingData, label: 'markflowy' })

      if (changesErrorReporting && preferenceRevision === errorReportingPreferenceRevision) {
        errorReportingRevoked = false
        syncErrorReportingPreference(newSettingData.error_reporting_enabled === true)
      }

      emit('app_conf_change')
    } catch (error) {
      logger.error('Failed to write app setting:', error)
      setSettingData(settingData)
      throw error
    }
  })
  settingWriteQueue = write.catch(() => undefined)
  return write
}

export const writeSettingData = async (
  item: Pick<Setting.SettingItem, 'key' | 'afterWrite'>,
  value: any,
) => {
  await writeSettingPatch({ [item.key]: value })
  item.afterWrite?.(value)
}

const appSettingService = {
  appSettingStoreSetup,
  writeSettingData,
  writeSettingPatch,
}

export default appSettingService
