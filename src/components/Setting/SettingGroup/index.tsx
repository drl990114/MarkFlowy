import SettingItem from '../SettingItems'

const SettingGroup: React.FC<SettingGroupProps> = (props) => {
  const { group, groupKey, categoryKey } = props

  const itemKeys = Object.keys(group)

  return (
    <>
      {itemKeys.map((key) => (
        <SettingItem item={group[key]} itemKey={key} itemParentKey={groupKey} categoryKey={categoryKey} />
      ))}
    </>
  )
}

interface SettingGroupProps {
  group: Setting.SettingGroup
  groupKey: string
  categoryKey: string
}

export default SettingGroup
