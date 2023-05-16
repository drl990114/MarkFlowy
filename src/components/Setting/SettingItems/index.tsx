import InputSettingItem from './Input'
import SelectSettingItem from './Select'

const SettingItem: React.FC<SettingItemProps> = (props) => {
  const { item } = props
  if (item.type === 'select') {
    return <SelectSettingItem {...props} />
  }

  if (item.type === 'input') {
    return <InputSettingItem {...props} />
  }

  return <></>
}

export interface SettingItemProps {
  item: Setting.SettingItem
  itemKey: string
  itemParentKey: string
  categoryKey: string
}

export default SettingItem
