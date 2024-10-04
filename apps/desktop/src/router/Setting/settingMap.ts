import SettingSchema from './settingSchema.json'
export enum SettingKeys {
  language = 'language',
  chatgpt = 'extensions_chatgpt_apikey',
  chatgpt_url = 'extensions_chatgpt_apibase',
  chatgpt_models = 'extensions_chatgpt_models'
}

export default SettingSchema

export type SettingData = typeof SettingSchema
