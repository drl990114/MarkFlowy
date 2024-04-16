import { Input } from 'zens'
import { memo, useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { SettingLabel } from './Label'
import { SettingItemContainer } from './Container'
import useAppSettingStore from '@/stores/useAppSettingStore'
import appSettingService from '@/services/app-setting'
import { debounce } from 'lodash'

const InputSettingItem: React.FC<SettingItemProps<Setting.InputSettingItem>> = memo((
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = settingData[item.key] as unknown as string

  const [inputValue, setInputValue] = useState<string>(curValue)

  useEffect(() => {
    setInputValue(curValue)
  }, [curValue])

  const writeSettingData = useCallback(
    debounce((value) => {
      appSettingService.writeSettingData(item, value)
    }, 1000),
    [item],
  )

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    writeSettingData(value)
  }, [writeSettingData])

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <Input
        value={inputValue}
        onChange={handleChange}
      />
    </SettingItemContainer>
  )
})

export default InputSettingItem
