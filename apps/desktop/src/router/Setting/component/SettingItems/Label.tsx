import { useTranslation } from '@/i18n'
import type { CSSProperties } from 'react'
import styled from 'styled-components'

interface SettingLabelProps {
  item: Setting.BaseSettingItem
  htmlFor?: string
  style?: CSSProperties
}

export const SettingLabel = (props: SettingLabelProps) => {
  const { htmlFor, item, style } = props
  const { t } = useTranslation()

  return (
    <Container style={style}>
      <label className='setting-item__title' htmlFor={htmlFor}>
        {t(item.title.i18nKey)}
      </label>
      {item.desc ? <span className='setting-item__label'>{t(item.desc.i18nKey)}</span> : null}
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  .setting-item__title {
    margin-bottom: 4px;
    font-size: 14px;
    font-weight: 500;
    color: ${({ theme }) => theme.primaryFontColor};
  }

  .setting-item__label {
    white-space: pre-wrap;
    font-size: 13px;
    color: ${({ theme }) => theme.labelFontColor};
  }
`
