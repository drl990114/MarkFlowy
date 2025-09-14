declare namespace Setting {
  type SettingData = Record<string, SettingGroup>

  type SettingGroup = {
    i18nKey: string
    iconName: string
  } & Record<string, SettingItem>

  type SettingItem = SelectSettingItem | InputSettingItem | SwitchSettingItem | SliderSettingItem | FontListSelectSettingItem

  type BaseSettingItem = {
    key: string
    title: {
      i18nKey: string
    }
    desc?: {
      i18nKey: string
    }
  }

  type SelectSettingItem = {
    type: 'select'
    options: readonly T[]
  } & BaseSettingItem

  type FontListSelectSettingItem = {
    type: 'fontListSelect'
  } & BaseSettingItem

  type InputSettingItem = {
    type: 'input'
  } & BaseSettingItem

  type SwitchSettingItem = {
    type: 'switch'
  } & BaseSettingItem

  type SliderSettingItem = {
    type: 'slider'
    scope: [number, number]
    step?: number
    /**
     * Save the value to string
     */
    saveToString?: boolean
  } & BaseSettingItem
}
