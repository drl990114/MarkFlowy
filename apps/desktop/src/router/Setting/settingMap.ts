const settingMap = {
  general: {
    "Auto Save": {
      autosave: {
        key: 'autosave',
        title: 'Switch auto save',
        desc: 'Switch auto save, Active file will be automatically saved at set intervals.',
        type: 'switch',
      },
      autosaveInterval: {
        key: 'autosave_interval',
        type: 'slider',
        title: 'Auto save interval',
        desc: 'Set the interval of auto save, in milliseconds.',
        scope: [1000, 10000]
      }
    },
    "Misc": {
      language: {
        key: 'language',
        type: 'select',
        title: 'Language',
        desc: 'Set the language of the app.',
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
        title: 'Api Key',
        desc: 'Api Key for ChatGPT',
      },
    },
  },
  keyboard: {}
}

export enum SettingKeys {
  language = 'language',
  chatgpt = 'extensions_chatgpt_apikey',
}

export default settingMap

export type SettingData = typeof settingMap
