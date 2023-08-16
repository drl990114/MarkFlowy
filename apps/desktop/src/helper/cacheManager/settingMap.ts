const settingMap = {
  general: {
    misc: {
      language: {
        key: 'language',
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
        key: 'extensions_chatgpt_apikey',
        type: 'input',
      },
    },
  },
  keyboard: {}
}

export enum SettingKeys {
  language = 'language',
  chatgpt = 'extensions_chatgpt_apikey',
}

export const SETTING_VERSION = '0.0.2'

export default settingMap

export type SettingData = typeof settingMap
