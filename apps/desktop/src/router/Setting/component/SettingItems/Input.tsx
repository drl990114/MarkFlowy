import { Input } from 'zens'
import { memo, useCallback } from 'react'
import type { SettingItemProps } from '.'
import { SettingLabel } from './Label'
import { SettingItemContainer } from './Container'
import useAppSettingStore from '@/stores/useAppSettingStore'
import appSettingService from '@/services/app-setting'

const InputSettingItem: React.FC<SettingItemProps<Setting.InputSettingItem>> = memo((
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = settingData[item.key] as unknown as string

  const handleChange = useCallback(
    (e: { target: { value: any } }) => {
      const settingValue = e.target.value
      appSettingService.writeSettingData(item, settingValue)
    },
    [item],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Input
        value={curValue}
        onChange={handleChange}
      />
    </SettingItemContainer>
  )
})

export default InputSettingItem
