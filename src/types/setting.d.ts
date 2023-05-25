
declare namespace Setting {
  type SettingData = Record<string, SettingGroup>
  
  type SettingGroup = Record<string, SettingItem>

  type SettingItem = SelectSettingItem | InputSettingItem
  
  type SelectSettingItem<T = { title: string; value: any }>= {
    type: 'select'
    key: string
    value: T
    options: ReadonlyArray<T>
  }

  type InputSettingItem =  {
    type: 'input'
    key: string;
    value: string;
  }
}
