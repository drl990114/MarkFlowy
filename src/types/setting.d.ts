declare namespace Setting {
  type SettingGroup = Record<string, SettingItem>

  interface SettingItem<T = { title: string; value: any }> {
    type: 'select'
    value: T
    options: ReadonlyArray<T>
  }
}
