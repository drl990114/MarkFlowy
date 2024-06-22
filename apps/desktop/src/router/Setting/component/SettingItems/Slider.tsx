import { useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { Slider } from '@mui/material'
import { SettingLabel } from './Label'
import { SettingItemContainer } from './Container'
import useAppSettingStore from '@/stores/useAppSettingStore'
import appSettingService from '@/services/app-setting'
import { debounce } from 'lodash'

const SliderSettingItem: React.FC<SettingItemProps<Setting.SliderSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = settingData[item.key] as unknown as number
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
    }, 200),
    [item],
  )

  const handleChange = useCallback(
    (_e: Event, v: number | number[]) => {
      setValue(v)
      writeSettingData(v)
    },
    [writeSettingData],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item}/>
      <Slider
        className='setting-item__slider'
        value={value}
        onChange={handleChange}
        valueLabelDisplay='auto'
        step={item.step || 1}
        min={item.scope[0]}
        max={item.scope[1]}
      />
    </SettingItemContainer>
  )
}

export default SliderSettingItem
