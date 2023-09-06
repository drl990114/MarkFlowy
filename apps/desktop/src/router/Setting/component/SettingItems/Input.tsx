import { Input } from '@/components/Input'
import { useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { useGlobalSettingData } from '@/hooks'
import { SettingLabel } from './Label'
import { SettingItemContainer } from './Container'

const InputSettingItem: React.FC<SettingItemProps<Setting.InputSettingItem>> = (
  props,
) => {
  const { item } = props
  const [settingData, handler] = useGlobalSettingData()
  const { writeSettingData } = handler
  const curValue = settingData[item.key] as unknown as string
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value)
      setValue(curValue)
  }, [curValue, value])

  const handleChange = useCallback(
    (e: { target: { value: any } }) => {
      const settingValue = e.target.value
      writeSettingData(item, settingValue)
    },
    [item, writeSettingData],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Input
        value={value}
        onChange={handleChange}
      />
    </SettingItemContainer>
  )
}

export default InputSettingItem
