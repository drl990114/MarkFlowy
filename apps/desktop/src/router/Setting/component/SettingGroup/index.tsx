import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import { getSettingGroupAnchorId } from '../../settingSearch'
import SettingItem from '../SettingItems'
import { SettingGroupContainer } from './styles'

const SettingGroup: React.FC<SettingGroupProps> = (props) => {
  const { activeChildId, group } = props
  const { t } = useTranslation()

  const children = useMemo(
    () => (Array.isArray(group.children) ? group.children : []),
    [group.children],
  )
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

  useEffect(() => {
    if (activeChildId && children.some((item, index) => childId(item, index) === activeChildId)) {
      setSelectedChildId(activeChildId)
    }
  }, [activeChildId, children])

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
      <SettingGroupContainer
        $anchorId={getSettingGroupAnchorId(props.categoryKey, props.groupKey, selectedChildId)}
      >
        <div className='setting-group__title'>{t(group.i18nKey)}</div>
        <div
          aria-label={t(group.i18nKey)}
          role='tablist'
          style={{ display: 'flex', justifyItems: 'flex-start', alignItems: 'center' }}
        >
          {children.map((item, index) => (
            <TabItem
              $active={tabIndex === index}
              aria-selected={tabIndex === index}
              key={childId(item, index)}
              role='tab'
              type='button'
              onClick={() => setSelectedChildId(childId(item, index))}
            >
              {t(item.i18nKey)}
            </TabItem>
          ))}
        </div>
        <div role='tabpanel'>{renderParams(children[tabIndex], { titleVisible: false })}</div>
      </SettingGroupContainer>
    )
  } else {
    return (
      <SettingGroupContainer $anchorId={getSettingGroupAnchorId(props.categoryKey, props.groupKey)}>
        {renderParams(group)}
      </SettingGroupContainer>
    )
  }
}

const TabItem = styled.button<{ $active: boolean }>`
  appearance: none;
  background: transparent;
  border: 0;
  border-top: 3px solid ${(props) =>
    props.$active ? props.theme.accentColor : 'transparent'};
  font-family: inherit;
  margin-right: 6px;
  margin-bottom: 20px;
  padding-top: 6px;
  font-size: var(--mf-ui-font-body);
  line-height: var(--mf-ui-line-height-body);
  letter-spacing: var(--mf-ui-tracking-body);
  font-weight: 600;
  cursor: pointer;
  color: ${(props) => (props.$active ? props.theme.primaryFontColor : props.theme.labelFontColor)};

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 2px;
  }
`

interface SettingGroupProps {
  group: Setting.SettingGroup
  groupKey: string
  categoryKey: string
  activeChildId?: string
}

export default SettingGroup
