import SettingSchema from './settingSchema.json'
export enum SettingKeys {
  language = 'language',
  chatgpt = 'extensions_chatgpt_apikey',
}

export default SettingSchema

export type SettingData = typeof SettingSchema
