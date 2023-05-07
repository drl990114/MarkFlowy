import SelectSettingItem from './Select'

const SettingItem: React.FC<SettingItemProps> = (props) => {
  if (props.item.type === 'select') {
    return <SelectSettingItem {...props} />
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
