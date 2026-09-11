import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from '@/i18n'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useLayoutStore, {
  type LeftDockStartup,
  type RightDockStartup,
} from '@/stores/useLayoutStore'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const SelectSettingItem: React.FC<SettingItemProps<Setting.SelectSettingItem>> = (props) => {
  const { item } = props
  const settingValue = useAppSettingStore((state) => state.settingData[item.key])
  const layoutValue = useLayoutStore((state) =>
    item.storage === 'layout'
      ? item.key === 'leftStartup'
        ? state.leftStartup
        : state.rightStartup
      : undefined,
  )
  const { t } = useTranslation()
  const currentValue = String(layoutValue ?? settingValue ?? '')

  return (
    <SettingItemContainer $settingKey={item.key}>
      <SettingLabel item={item} />
      <Select
        value={currentValue}
        onValueChange={(value) => {
          if (item.storage === 'layout') {
            useLayoutStore
              .getState()
              .setStartupPanel(
                item.key === 'leftStartup' ? 'left' : 'right',
                value as LeftDockStartup | RightDockStartup,
              )
          } else {
            appSettingService.writeSettingData(item, value)
          }
        }}
      >
        <SelectTrigger aria-label={t(item.title.i18nKey)} className='setting-item__control'>
          <SelectValue placeholder={t('settings.select_placeholder')} />
        </SelectTrigger>
        <SelectContent>
          {item.options.map((option) => (
            <SelectItem key={String(option.value)} value={String(option.value)}>
              {option.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingItemContainer>
  )
}

export default SelectSettingItem
