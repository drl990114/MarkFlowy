import appSettingService from '@/services/app-setting'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { Input } from 'antd'
import { debounce } from 'lodash'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_CURRENT_DATE_FORMAT, formatCurrentDate } from 'rme'
import styled from 'styled-components'
import { useTranslation } from '@/i18n'
import type { SettingItemProps } from '.'
import { SettingItemContainer } from './Container'
import { SettingLabel } from './Label'

const PreviewWrap = styled.div`
  margin-top: 8px;
  font-size: ${(props) => props.theme.fontSm};
  color: ${(props) => props.theme.labelFontColor};
`

const PreviewValue = styled.code`
  margin-left: 6px;
  color: ${(props) => props.theme.primaryFontColor};
  word-break: break-all;
`

const ControlWrap = styled.div`
  width: min(360px, 100%);
`

const DateFormatSettingItem: React.FC<SettingItemProps<Setting.DateFormatSettingItem>> = memo((
  props,
) => {
  const { item } = props
  const { t } = useTranslation()
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
      writeSettingData.cancel()
    }
  }, [writeSettingData])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    writeSettingData(value)
  }, [writeSettingData])

  const preview = useMemo(() => formatCurrentDate(inputValue), [inputValue])

  return (
    <SettingItemContainer>
      <SettingLabel item={item} />
      <ControlWrap>
        <Input
          value={inputValue}
          onChange={handleChange}
          placeholder={item.placeholder || DEFAULT_CURRENT_DATE_FORMAT}
        />
        <PreviewWrap aria-live='polite'>
          {t('settings.editor.behavior.insert_date_format.preview')}
          <PreviewValue>{preview}</PreviewValue>
        </PreviewWrap>
      </ControlWrap>
    </SettingItemContainer>
  )
})

export default DateFormatSettingItem
