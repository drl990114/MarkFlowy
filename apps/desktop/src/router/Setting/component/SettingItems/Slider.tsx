import { useCallback, useEffect, useState } from 'react'
import type { SettingItemProps } from '.'
import { Slider } from '@mui/material'
import { SettingLabel } from './Label'
import { SettingItemContainer } from './Container'
import useAppSettingStore from '@/stores/useAppSettingStore'
import appSettingService from '@/services/app-setting'

const SliderSettingItem: React.FC<SettingItemProps<Setting.SliderSettingItem>> = (props) => {
  const { item } = props
  const { settingData } = useAppSettingStore()
  const curValue = settingData[item.key] as unknown as number
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value) setValue(curValue)
  }, [curValue, value])

  const handleChange = useCallback(
    (_e: Event, v: number | number[]) => {
      appSettingService.writeSettingData(item, v as number)
    },
    [item],
  )

  return (
    <SettingItemContainer>
      <SettingLabel item={item}/>
      <Slider
        className='setting-item__slider'
        value={value}
        onChange={handleChange}
        valueLabelDisplay='auto'
        min={item.scope[0]}
        max={item.scope[1]}
      />
    </SettingItemContainer>
  )
}

export default SliderSettingItem
