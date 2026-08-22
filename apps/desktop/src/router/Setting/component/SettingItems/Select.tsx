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
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const SelectSettingItem: React.FC<SettingItemProps<Setting.SelectSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const { t } = useTranslation()
  const currentValue = String(settingData[item.key] ?? '')

  return (
    <SettingItemContainer $settingKey={item.key}>
      <SettingLabel item={item} />
      <Select
        value={currentValue}
        onValueChange={(value) => {
          appSettingService.writeSettingData(item, value)
        }}
      >
        <SelectTrigger aria-label={t(item.title.i18nKey)} style={{ width: 200 }}>
          <SelectValue placeholder='请选择' />
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
