import { useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { useGlobalSettingData } from '@/hooks'
import { Switch } from '@mui/material'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const SwitchSettingItem: React.FC<SettingItemProps<Setting.SwitchSettingItem>> = (
  props,
) => {
  const { item } = props
  const [settingData, handler] = useGlobalSettingData()
  const { writeSettingData } = handler
  const curValue = settingData[item.key] as unknown as boolean
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value)
      setValue(curValue)
  }, [curValue, value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement> ) => {
      const settingValue = e.target.checked
      writeSettingData(item, settingValue)
    },
    [item, writeSettingData],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item}/>
      <Switch
        checked={value}
        onChange={handleChange}
      />
    </SettingItemContainer>
  )
}

export default SwitchSettingItem
