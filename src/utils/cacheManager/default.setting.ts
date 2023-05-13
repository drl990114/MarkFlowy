import { Langs } from './../../i18n/index';

const defaultSetting = {
  general: {
    misc: {
      language: {
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
}

export const SETTING_VERSION = '0.0.1'

export default defaultSetting

export type SettingData = typeof defaultSetting
