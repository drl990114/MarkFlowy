import { useCallback } from 'react'
import type { SettingItemProps } from '.'
import { Switch } from '@mui/material'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'

const SwitchSettingItem: React.FC<SettingItemProps<Setting.SwitchSettingItem>> = (
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = settingData[item.key] as unknown as boolean

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> ) => {
      const settingValue = e.target.checked
      appSettingService.writeSettingData(item, settingValue)
    },
    [item],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item}/>
      <Switch
        checked={curValue}
        onChange={handleChange}
      />
    </SettingItemContainer>
  )
}

export default SwitchSettingItem
