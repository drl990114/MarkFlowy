import { exists, readTextFile, writeFile } from '@tauri-apps/api/fs'
import { BaseDirectory, appConfigDir } from '@tauri-apps/api/path'
import defaultSetting from './default.setting'
import { changeLng } from '@i18n'
import { emit } from '@tauri-apps/api/event'
import { EVENT } from '@constants'

const SETTING_FILE_NAME = 'linebyline.setting.json'
class CacheManager {
  settingData: Record<string, any> = defaultSetting

  init = async () => {
    await this.readSetting()
    changeLng(this.settingData.general.misc.language.value)
  }

  readSetting = async () => {
    const isExists = await exists(SETTING_FILE_NAME, { dir: BaseDirectory.AppCache })
    if (!isExists) {
      await this.saveSetting()
    }
    const setting = await readTextFile(SETTING_FILE_NAME, { dir: BaseDirectory.AppCache })
    this.settingData = JSON.parse(setting)
    emit(EVENT.setting_data_loaded, this.settingData)
    return setting
  }

  writeSetting = (categoryKey: string, parentKey: string, key: string, item: Pick<Setting.SettingItem, 'value'>) => {
    this.settingData[categoryKey][parentKey][key].value = item.value
    this.saveSetting()
  }

  saveSetting = () => {
    writeFile(SETTING_FILE_NAME, JSON.stringify(this.settingData), { dir: BaseDirectory.AppCache }).then(() => {
      emit(EVENT.setting_data_change, this.settingData)
    })
  }
}

const CacheManagerInstance = new CacheManager()
export default CacheManagerInstance
