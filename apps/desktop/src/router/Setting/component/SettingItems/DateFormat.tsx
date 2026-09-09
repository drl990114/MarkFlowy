import { Input } from '@/components/ui/input'
import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_CURRENT_DATE_FORMAT, formatCurrentDate } from 'rme'
import styled from 'styled-components'
import { useTranslation } from '@/i18n'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const PreviewWrap = styled.div`
  margin-top: 6px;
  font-size: var(--mf-ui-font-caption);
  line-height: var(--mf-ui-line-height-control);
  color: ${(props) => props.theme.labelFontColor};
`

const PreviewValue = styled.code`
  margin-left: 6px;
  color: ${(props) => props.theme.primaryFontColor};
  word-break: break-all;
`

const DateFormatSettingItem: React.FC<SettingItemProps<Setting.DateFormatSettingItem>> = memo((
  props,
) => {
  const { item } = props
  const { t } = useTranslation()
  const inputId = `setting-${item.key}`
  const storedValue = useAppSettingStore((state) => state.settingData[item.key] as string | undefined)
  const curValue = storedValue || DEFAULT_CURRENT_DATE_FORMAT
  const [inputValue, setInputValue] = useState(curValue)

  useEffect(() => {
    setInputValue(curValue)
  }, [curValue])

  const writeSettingData = useMemo(
    () =>
      debounce((value: string) => {
        appSettingService.writeSettingData(
          { key: item.key, afterWrite: item.afterWrite },
          value.trim() || DEFAULT_CURRENT_DATE_FORMAT,
        )
      }, 500),
    [item.afterWrite, item.key],
  )

  useEffect(() => {
    return () => {
      writeSettingData.flush()
    }
  }, [writeSettingData])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    writeSettingData(value)
  }, [writeSettingData])

  const preview = useMemo(() => formatCurrentDate(inputValue), [inputValue])

  return (
    <SettingItemContainer $settingKey={item.key}>
      <SettingLabel htmlFor={inputId} item={item} />
      <div className='setting-item__control'>
        <Input
          id={inputId}
          value={inputValue}
          onBlur={() => writeSettingData.flush()}
          onChange={handleChange}
          placeholder={item.placeholder || DEFAULT_CURRENT_DATE_FORMAT}
        />
        <PreviewWrap aria-live='polite'>
          {t('settings.editor.behavior.insert_date_format.preview')}
          <PreviewValue>{preview}</PreviewValue>
        </PreviewWrap>
      </div>
    </SettingItemContainer>
  )
})

export default DateFormatSettingItem
