import { useEffect, useId, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/i18n'
import { getSettingGroupAnchorId } from '../../settingSearch'
import SettingItem from '../SettingItems'
import { SettingGroupContainer } from './styles'

const SettingGroup: React.FC<SettingGroupProps> = (props) => {
  const { activeChildId, group } = props
  const { t } = useTranslation()
  const tabId = useId()

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
          <h2 className='setting-group__title'>{t(groupItem.i18nKey)}</h2>
        ) : null}
        <div className='setting-group__items'>
          {itemKeys.map((key) => (
            <SettingItem key={key} item={groupItem[key]} />
          ))}
        </div>
      </>
    )
  }

  if (children.length > 0) {
    return (
      <SettingGroupContainer
        $anchorId={getSettingGroupAnchorId(props.categoryKey, props.groupKey, selectedChildId)}
      >
        <h2 className='setting-group__title'>{t(group.i18nKey)}</h2>
        <div
          aria-label={t(group.i18nKey)}
          role='tablist'
          className='flex flex-wrap items-center gap-1 px-1 pb-2'
        >
          {children.map((item, index) => (
            <Button
              size='sm'
              variant='ghost'
              className={cn(
                'font-normal text-muted-foreground',
                tabIndex === index &&
                  'bg-control-selected text-foreground hover:bg-control-selected',
              )}
              aria-selected={tabIndex === index}
              aria-controls={`${tabId}-panel`}
              id={`${tabId}-${index}`}
              key={childId(item, index)}
              role='tab'
              tabIndex={tabIndex === index ? 0 : -1}
              onClick={() => setSelectedChildId(childId(item, index))}
              onKeyDown={(event) => {
                let nextIndex: number
                if (event.key === 'ArrowRight') nextIndex = (index + 1) % children.length
                else if (event.key === 'ArrowLeft')
                  nextIndex = (index + children.length - 1) % children.length
                else if (event.key === 'Home') nextIndex = 0
                else if (event.key === 'End') nextIndex = children.length - 1
                else return
                event.preventDefault()
                setSelectedChildId(childId(children[nextIndex], nextIndex))
                document.getElementById(`${tabId}-${nextIndex}`)?.focus()
              }}
            >
              {t(item.i18nKey)}
            </Button>
          ))}
        </div>
        <div role='tabpanel' id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tabIndex}`}>
          {renderParams(children[tabIndex], { titleVisible: false })}
        </div>
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

interface SettingGroupProps {
  group: Setting.SettingGroup
  groupKey: string
  categoryKey: string
  activeChildId?: string
}

export default SettingGroup
