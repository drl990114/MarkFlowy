import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import SettingItem from '../SettingItems'
import { SettingGroupContainer } from './styles'

const SettingGroup: React.FC<SettingGroupProps> = (props) => {
  const { group } = props
  const { t } = useTranslation()
  const [tabIndex, setTabIndex] = useState(0)

  const renderParams = (groupItem: Setting.SettingGroup, config = { titleVisible: true }) => {
    const itemKeys = Object.keys(groupItem).filter((key) => key !== 'i18nKey')

    return (
      <>
        {config.titleVisible ? (
          <div className='setting-group__title'>{t(groupItem.i18nKey)}</div>
        ) : null}
        {itemKeys.map((key) => (
          <SettingItem
            key={key}
            item={groupItem[key]}
          />
        ))}
      </>
    )
  }

  if (Array.isArray(group.children)) {
    return (
      <SettingGroupContainer>
        <div className='setting-group__title'>{t(group.i18nKey)}</div>
        <div style={{ display: 'flex', justifyItems: 'flex-start', alignItems: 'center' }}>
          {group.children.map((item, index) => (
            <TabItem
              active={tabIndex === index}
              key={item.i18nKey}
              onClick={() => setTabIndex(index)}
            >
              {t(item.i18nKey)}
            </TabItem>
          ))}
        </div>
        {renderParams(group.children[tabIndex], { titleVisible: false })}
      </SettingGroupContainer>
    )
  } else {
    return <SettingGroupContainer>{renderParams(group)}</SettingGroupContainer>
  }
}

const TabItem = styled.div<{ active: boolean }>`
  margin-right: 6px;
  margin-bottom: 20px;
  padding-top: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: ${(props) => (props.active ? props.theme.primaryFontColor : props.theme.labelFontColor)};
  border-top: 3px solid ${(props) => (props.active ? props.theme.accentColor : 'transparent')};
`

interface SettingGroupProps {
  group: Setting.SettingGroup
  groupKey: string
  categoryKey: string
}

export default SettingGroup
