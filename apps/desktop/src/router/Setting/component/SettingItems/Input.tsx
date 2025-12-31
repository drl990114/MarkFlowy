import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { Input } from 'antd'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const InputSettingItem: React.FC<SettingItemProps<Setting.InputSettingItem>> = memo((
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = item.valuePreHandle ? item.valuePreHandle(settingData[item.key] as unknown as string) : settingData[item.key] as unknown as string

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
        style={{ maxWidth: '300px' }}
        value={inputValue}
        onChange={handleChange}
        prefix={item.prefix}
        suffix={item.suffix}
      />
    </SettingItemContainer>
  )
})

export default InputSettingItem
