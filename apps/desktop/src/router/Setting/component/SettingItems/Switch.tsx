import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { Switch } from 'antd'
import { useCallback } from 'react'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const SwitchSettingItem: React.FC<SettingItemProps<Setting.SwitchSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = settingData[item.key] as unknown as boolean

  const handleChange = useCallback(
    (checked: boolean) => {
      appSettingService.writeSettingData(item, checked)
    },
    [item],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Switch checked={curValue} onChange={handleChange} />
    </SettingItemContainer>
  )
}

export default SwitchSettingItem
