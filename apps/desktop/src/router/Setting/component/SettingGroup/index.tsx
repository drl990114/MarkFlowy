import { useState } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import SettingItem from '../SettingItems'
import { SettingGroupContainer } from './styles'

const SettingGroup: React.FC<SettingGroupProps> = (props) => {
  const { activeChildId, group } = props
  const { t } = useTranslation()

  const children = Array.isArray(group.children) ? group.children : []
  const childId = (item: Setting.SettingGroup, index: number) =>
    String((item as Setting.SettingGroup & { providerId?: string }).providerId ?? index)
  const [selectedChildId, setSelectedChildId] = useState(() =>
    activeChildId && children.some((item, index) => childId(item, index) === activeChildId)
      ? activeChildId
      : children.length > 0
        ? childId(children[0], 0)
        : '',
  )
  const tabIndex = Math.max(
    0,
    children.findIndex((item, index) => childId(item, index) === selectedChildId),
  )

  const renderParams = (groupItem: Setting.SettingGroup, config = { titleVisible: true }) => {
    const itemKeys = Object.keys(groupItem).filter(
      (key) => !['i18nKey', 'providerId', 'iconName', 'desc', 'children'].includes(key),
    )

    return (
      <>
        {config.titleVisible ? (
          <div className='setting-group__title'>{t(groupItem.i18nKey)}</div>
        ) : null}
        {itemKeys.map((key) => (
          <SettingItem key={key} item={groupItem[key]} />
        ))}
      </>
    )
  }

  if (children.length > 0) {
    return (
      <SettingGroupContainer>
        <div className='setting-group__title'>{t(group.i18nKey)}</div>
        <div style={{ display: 'flex', justifyItems: 'flex-start', alignItems: 'center' }}>
          {children.map((item, index) => (
            <TabItem
              $active={tabIndex === index}
              key={childId(item, index)}
              onClick={() => setSelectedChildId(childId(item, index))}
            >
              {t(item.i18nKey)}
            </TabItem>
          ))}
        </div>
        {renderParams(children[tabIndex], { titleVisible: false })}
      </SettingGroupContainer>
    )
  } else {
    return <SettingGroupContainer>{renderParams(group)}</SettingGroupContainer>
  }
}

const TabItem = styled.div<{ $active: boolean }>`
  margin-right: 6px;
  margin-bottom: 20px;
  padding-top: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: ${(props) => (props.$active ? props.theme.primaryFontColor : props.theme.labelFontColor)};
  border-top: 3px solid ${(props) => (props.$active ? props.theme.accentColor : 'transparent')};
`

interface SettingGroupProps {
  group: Setting.SettingGroup
  groupKey: string
  categoryKey: string
  activeChildId?: string
}

export default SettingGroup
