declare namespace Setting {
  type SettingData = Record<string, SettingGroup>

  type SettingGroup = Record<string, SettingItem>

  type SettingItem = SelectSettingItem | InputSettingItem

  type SelectSettingItem = {
    type: 'select'
    key: string
    options: readonly T[]
  }

  type InputSettingItem = {
    type: 'input'
    key: string
  }
}
