import { useGlobalSettingData } from '@/hooks'
import { Input } from '@mui/material'
import { useCallback, useEffect, useState } from 'react'
import { SettingItemProps } from '.'

const InputSettingItem: React.FC<SettingItemProps<Setting.InputSettingItem>> = (props) => {
  const { item, itemKey } = props
  const [settingData, handler] = useGlobalSettingData()
  const { writeSettingData } = handler
  const curValue = settingData[item.key] as unknown as string
  const [value, setValue] = useState(curValue)

  useEffect(() => {
    if (curValue !== value) {
      setValue(curValue)
    }
  }, [curValue])

  const handleChange = useCallback((e: { target: { value: any } }) => {
    const value = e.target.value
    writeSettingData(item, value)
  }, [item])

  return (
    <label>
      <label className='setting-item__label'>{itemKey}:</label>
      <Input className='setting-item__form' value={value} onChange={handleChange} />
    </label>
  )
}

export default InputSettingItem
