
const settingMap = {
  general: {
    misc: {
      language: {
        key: "language",
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
    chatgpt: {
      apikey: {
        key: "extensions_chatgpt_apikey",
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
