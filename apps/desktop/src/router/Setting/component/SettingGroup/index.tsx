import { useTranslation } from 'react-i18next'
import SettingItem from '../SettingItems'
import { SettingGroupContainer } from './styles'

const SettingGroup: React.FC<SettingGroupProps> = (props) => {
  const { group, groupKey, categoryKey } = props
  const { t } = useTranslation()
  const itemKeys = Object.keys(group).filter(key => key !== 'i18nKey')

  return (
    <SettingGroupContainer>
      <div className="setting-group__title">{t(group.i18nKey)}</div>
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
