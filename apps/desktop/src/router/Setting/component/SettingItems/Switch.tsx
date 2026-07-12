import { Switch } from '@/components/ui/switch'
import { useTranslation } from '@/i18n'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { useCallback } from 'react'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const SwitchSettingItem: React.FC<SettingItemProps<Setting.SwitchSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const { t } = useTranslation()
  const curValue = Boolean(settingData[item.key])

  const handleChange = useCallback(
    (checked: boolean) => {
      appSettingService.writeSettingData(item, checked)
    },
    [item],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Switch
        aria-label={t(item.title.i18nKey)}
        checked={curValue}
        onCheckedChange={handleChange}
      />
    </SettingItemContainer>
  )
}

export default SwitchSettingItem
