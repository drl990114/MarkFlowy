export function isSelectSettingItem(
  item: Setting.SettingItem,
): item is Setting.SelectSettingItem {
  return item.type === 'select'
}

export function isInputSettingItem(
  item: Setting.SettingItem,
): item is Setting.InputSettingItem {
  return item.type === 'input'
}

export function isSwitchSettingItem(
  item: Setting.SettingItem,
): item is Setting.SwitchSettingItem {
  return item.type === 'switch'
}

export function isSliderSettingItem(
  item: Setting.SettingItem,
): item is Setting.SliderSettingItem {
  return item.type === 'slider'
}

export function isFontListSelectSettingItem(
  item: Setting.SettingItem,
): item is Setting.FontListSelectSettingItem {
  return item.type === 'fontListSelect'
}
