import InputSettingItem from './Input'
import SelectSettingItem from './Select'

function isSelectSettingItem(
  item: Setting.SettingItem,
): item is Setting.SelectSettingItem {
  return item.type === 'select'
}

function isInputSettingItem(
  item: Setting.SettingItem,
): item is Setting.InputSettingItem {
  return item.type === 'input'
}

const SettingItem: React.FC<SettingItemProps> = (props) => {
  const { item, ...otherProps } = props
  if (isSelectSettingItem(item))
    return <SelectSettingItem item={item} {...otherProps} />

  if (isInputSettingItem(item))
    return <InputSettingItem item={item} {...otherProps} />

  return <></>
}

export interface SettingItemProps<T = Setting.SettingItem> {
  item: T
  itemKey: string
  itemParentKey: string
  categoryKey: string
}

export default SettingItem
