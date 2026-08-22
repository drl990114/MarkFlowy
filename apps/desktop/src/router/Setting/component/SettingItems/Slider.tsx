import { RangeSlider, Slider } from '@/components/ui/slider'
import { useTranslation } from '@/i18n'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { debounce } from 'lodash'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

type RangeValue = [number, number]
type SliderValue = number | RangeValue

interface SliderControlProps {
  accessibleName: string
  item: Setting.SliderSettingItem
}

interface SingleSliderControlProps extends SliderControlProps {
  currentValue: number
}

interface RangeSliderControlProps extends SliderControlProps {
  currentValue: RangeValue
}

const useSettingWriter = (item: Setting.SliderSettingItem) => {
  const writeSettingData = useMemo(
    () =>
      debounce((nextValue: SliderValue) => {
        const storedValue = item.saveToString ? String(nextValue) : nextValue
        appSettingService.writeSettingData(item, storedValue)
      }, 1000),
    [item],
  )

  useEffect(() => () => writeSettingData.flush(), [writeSettingData])

  return writeSettingData
}

const SingleSliderControl = ({
  accessibleName,
  currentValue,
  item,
}: SingleSliderControlProps) => {
  const [value, setValue] = useState(currentValue)
  const writeSettingData = useSettingWriter(item)

  useEffect(() => {
    setValue(currentValue)
  }, [currentValue])

  const handleChange = useCallback(
    (nextValue: number) => {
      setValue(nextValue)
      writeSettingData(nextValue)
    },
    [writeSettingData],
  )

  const displayValue = String(Number(value.toFixed(4)))

  return (
    <div className='flex w-[180px] items-center gap-2'>
      <Slider
        aria-label={accessibleName}
        aria-valuetext={displayValue}
        className='setting-item__slider'
        value={value}
        onValueChange={handleChange}
        onValueCommit={() => writeSettingData.flush()}
        step={item.step || 1}
        min={item.scope[0]}
        max={item.scope[1]}
      />
      <output className='min-w-14 text-right text-xs text-muted-foreground tabular-nums'>
        {displayValue}
      </output>
    </div>
  )
}

const RangeSliderControl = ({
  accessibleName,
  currentValue,
  item,
}: RangeSliderControlProps) => {
  const [value, setValue] = useState<RangeValue>(currentValue)
  const writeSettingData = useSettingWriter(item)
  const [rangeStart, rangeEnd] = currentValue

  useEffect(() => {
    setValue([rangeStart, rangeEnd])
  }, [rangeEnd, rangeStart])

  const handleChange = useCallback(
    (nextValue: RangeValue) => {
      setValue(nextValue)
      writeSettingData(nextValue)
    },
    [writeSettingData],
  )

  const displayValue: RangeValue = [
    Number(value[0].toFixed(4)),
    Number(value[1].toFixed(4)),
  ]

  return (
    <div className='flex w-[200px] items-center gap-2'>
      <RangeSlider
        aria-label={accessibleName}
        ariaValueText={displayValue.map(String) as [string, string]}
        className='setting-item__slider'
        value={value}
        onValueChange={handleChange}
        onValueCommit={() => writeSettingData.flush()}
        step={item.step || 1}
        min={item.scope[0]}
        max={item.scope[1]}
      />
      <output className='min-w-20 text-right text-xs text-muted-foreground tabular-nums'>
        {displayValue.join(' – ')}
      </output>
    </div>
  )
}

const SliderSettingItem: React.FC<SettingItemProps<Setting.SliderSettingItem>> = (props) => {
  const { item } = props
  const rawValue = useAppSettingStore((state) => state.settingData[item.key])
  const { t } = useTranslation()

  const numericValue = Number(rawValue)
  const singleValue = Number.isFinite(numericValue) ? numericValue : item.scope[0]
  const rangeValue: RangeValue = Array.isArray(rawValue)
    ? [Number(rawValue[0] ?? item.scope[0]), Number(rawValue[1] ?? item.scope[1])]
    : [item.scope[0], item.scope[1]]
  const accessibleName = t(item.title.i18nKey)

  return (
    <SettingItemContainer $settingKey={item.key}>
      <SettingLabel item={item} />
      {Array.isArray(rawValue) ? (
        <RangeSliderControl
          accessibleName={accessibleName}
          currentValue={rangeValue}
          item={item}
        />
      ) : (
        <SingleSliderControl
          accessibleName={accessibleName}
          currentValue={singleValue}
          item={item}
        />
      )}
    </SettingItemContainer>
  )
}

export default SliderSettingItem
