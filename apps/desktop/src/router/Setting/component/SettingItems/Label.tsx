import { useTranslation } from "react-i18next"
import styled from "styled-components"

interface SettingLabelProps {
  item: Setting.BaseSettingItem
}

export const SettingLabel = (props: SettingLabelProps) => {
  const { item } = props
  const { t } = useTranslation()

  return <Container>
    <label className="setting-item__title">{t(item.title.i18nKey)}</label>
    {item.desc ? <label className="setting-item__label">{t((item.desc.i18nKey))}</label> : null}
  </Container>
}

const Container = styled.div`
  display: flex;
  flex-direction: column;

  .setting-item__title {
    margin-bottom: 4px;
    font-size: 14px;
    color: ${({ theme }) => theme.primaryFontColor};
  }

  .setting-item__label {
    font-size: 13px;
    color: ${({ theme }) => theme.labelFontColor};
  }
`
