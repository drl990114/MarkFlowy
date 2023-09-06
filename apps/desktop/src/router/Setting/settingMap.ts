const settingMap = {
  general: {
    "Auto Save": {
      autosave: {
        key: 'autosave',
        desc: 'Enable auto save, Active file will be automatically saved at set intervals.',
        type: 'switch',
      },
      autosaveInterval: {
        key: 'autosave_interval',
        type: 'slider',
        scope: [1000, 10000]
      }
    },
    "Misc": {
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

export default settingMap

export type SettingData = typeof settingMap
