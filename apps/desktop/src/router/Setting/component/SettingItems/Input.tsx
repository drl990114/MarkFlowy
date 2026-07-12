import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const InputSettingItem: React.FC<SettingItemProps<Setting.InputSettingItem>> = memo((
  props,
) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const inputId = `setting-${item.key}`
  const storedValue = String(settingData[item.key] ?? '')
  const curValue = item.valuePreHandle ? item.valuePreHandle(storedValue) : storedValue

  const [inputValue, setInputValue] = useState<string>(curValue)

  useEffect(() => {
    setInputValue(curValue)
  }, [curValue])

  const writeSettingData = useMemo(
    () =>
      debounce((nextValue: string) => {
        appSettingService.writeSettingData(item, nextValue)
      }, 1000),
    [item],
  )

  useEffect(() => () => writeSettingData.flush(), [writeSettingData])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    writeSettingData(value)
  }, [writeSettingData])

  return (
    <SettingItemContainer>
      <SettingLabel htmlFor={inputId} item={item} />
      {item.prefix || item.suffix ? (
        <InputGroup style={{ maxWidth: '300px' }}>
          {item.prefix && (
            <InputGroupAddon align='inline-start'>{item.prefix}</InputGroupAddon>
          )}
          <InputGroupInput
            id={inputId}
            value={inputValue}
            onBlur={() => writeSettingData.flush()}
            onChange={handleChange}
          />
          {item.suffix && (
            <InputGroupAddon align='inline-end'>{item.suffix}</InputGroupAddon>
          )}
        </InputGroup>
      ) : (
        <Input
          id={inputId}
          style={{ maxWidth: '300px' }}
          value={inputValue}
          onBlur={() => writeSettingData.flush()}
          onChange={handleChange}
        />
      )}
    </SettingItemContainer>
  )
})

export default InputSettingItem
