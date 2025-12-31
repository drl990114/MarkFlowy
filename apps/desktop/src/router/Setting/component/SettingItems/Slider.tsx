import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { Slider } from 'antd'
import { debounce } from 'lodash'
import { useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const SliderSettingItem: React.FC<SettingItemProps<Setting.SliderSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const rawValue = settingData[item.key]
  const isArrayType = Array.isArray(rawValue)
  const curValue = isArrayType ? (rawValue as number[]) : (rawValue as number)
  const [value, setValue] = useState<number | number[]>(curValue)

  useEffect(() => {
    setValue(curValue)
  }, [curValue])

  const writeSettingData = useCallback(
    debounce((value) => {
      if (item.saveToString) {
        value = String(value)
      }
      appSettingService.writeSettingData(item, value)
    }, 1000),
    [item],
  )

  const handleChange = useCallback(
    (v: number | number[]) => {
      setValue(v)
      writeSettingData(v)
    },
    [writeSettingData],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item}/>
      {isArrayType ? (
        <Slider
          className='setting-item__slider'
          value={value as number[]}
          range
          onChange={handleChange}
          step={item.step || 1}
          min={item.scope[0]}
          max={item.scope[1]}
        />
      ) : (
        <Slider
          className='setting-item__slider'
          value={value as number}
          onChange={handleChange}
          step={item.step || 1}
          min={item.scope[0]}
          max={item.scope[1]}
        />
      )}
    </SettingItemContainer>
  )
}

export default SliderSettingItem
