import { SETTING_VERSION } from './settingMap'

const defaultCache = {
  settingVersion: SETTING_VERSION, // Determine whether the default setting needs to be updated
  openFolderHistory: [],
}

export default defaultCache

export type CacheData = typeof defaultCache
