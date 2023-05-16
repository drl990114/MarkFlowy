import { Langs } from '../../i18n/index';

const settingMap = {
  general: {
    misc: {
      language: {
        key: "general.misc.language",
        value: 'en' as Langs,
        type: 'select',
        options: [
          {
            title: 'English',
            value: 'en',
          },
          {
            title: '简体中文',
            value: 'cn',
          },
        ],
      },
    },
  },
  extensions: {
    ChatGPT: {
      ApiKey: {
        key: "extensions.ChatGPT.ApiKey",
        value: '',
        type: 'input',
      }
    }
  }
}

export enum SettingKeys {
  language = 'general.misc.language',
  chatgpt = 'extensions.ChatGPT.ApiKey'
}

export const SETTING_VERSION = '0.0.2'

export default settingMap

export type SettingData = typeof settingMap
