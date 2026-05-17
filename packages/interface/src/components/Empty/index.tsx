import React, { memo } from 'react'
import { useTranslation } from '@markflowy/i18n'
import styled from 'styled-components'

const Container = styled.div`
  font-size: 3rem;
  color: ${(props) => props.theme.labelFontColor};
`

function Empty() {
  const { t } = useTranslation()

  return <Container className='fjic h-full w-full'>{t('common.none')}</Container>
}

export default memo(Empty)
