import { RangeSlider, Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  isDefault: boolean
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
  isDefault,
  item,
}: SingleSliderControlProps) => {
  const { t } = useTranslation()
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

  const numericDisplayValue = String(Number(value.toFixed(4)))
  const displayValue = item.valueLabelI18nKey
    ? t(item.valueLabelI18nKey, { value: numericDisplayValue })
    : numericDisplayValue

  return (
    <div className='setting-item__control flex flex-col gap-2'>
      {item.optionalValue ? (
        <Select
          value={isDefault ? 'default' : 'custom'}
          onValueChange={(mode) => {
            if (!item.optionalValue) return
            writeSettingData.cancel()
            const nextValue = item.optionalValue.initial
            appSettingService.writeSettingData(
              item,
              mode === 'default' ? null : item.saveToString ? String(nextValue) : nextValue,
            )
          }}
        >
          <SelectTrigger size='sm' aria-label={accessibleName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='default'>
              {item.optionalValue.defaultLabel ?? t('settings.editor.code_editing.default')}
            </SelectItem>
            <SelectItem value='custom'>{t('settings.editor.code_editing.custom')}</SelectItem>
          </SelectContent>
        </Select>
      ) : null}
      {!item.optionalValue || !isDefault ? (
        <div className='flex items-center gap-3'>
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
      ) : null}
      {item.optionalValue?.note ? (
        <p className='m-0 text-ui-caption text-muted-foreground'>{item.optionalValue.note}</p>
      ) : null}
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
    <div className='setting-item__control flex items-center gap-3'>
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

  const numericValue = Number(rawValue ?? item.optionalValue?.initial)
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
          isDefault={rawValue == null}
          item={item}
        />
      )}
    </SettingItemContainer>
  )
}

export default SliderSettingItem
