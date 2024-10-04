import SettingSchema from './settingSchema.json'
export enum SettingKeys {
  language = 'language',
  chatgpt = 'extensions_chatgpt_apikey',
  cahtgpt_url = 'extensions_chatgpt_apibase'
}

export default SettingSchema

export type SettingData = typeof SettingSchema
