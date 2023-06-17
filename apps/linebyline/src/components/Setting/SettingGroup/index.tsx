import SettingItem from '../SettingItems'
import { SettingGroupContainer } from './styles'

const SettingGroup: React.FC<SettingGroupProps> = (props) => {
  const { group, groupKey, categoryKey } = props

  const itemKeys = Object.keys(group)

  return (
    <SettingGroupContainer>
      <div className="setting-group__title">{groupKey}</div>
      {itemKeys.map(key => (
        <SettingItem
          key={key}
          item={group[key]}
          itemKey={key}
          itemParentKey={groupKey}
          categoryKey={categoryKey}
        />
      ))}
    </SettingGroupContainer>
  )
}

interface SettingGroupProps {
  group: Setting.SettingGroup
  groupKey: string
  categoryKey: string
}

export default SettingGroup
