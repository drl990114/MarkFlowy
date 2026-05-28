import { t } from '@/i18n'
import { openUrl } from '@tauri-apps/plugin-opener'
import React from 'react'
import styled from 'styled-components'

interface UnsupportedFileTypeProps {
  fileName?: string
}

const Container = styled.div`
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: ${(props) => props.theme.bgColor};
`

const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${(props) => props.theme.spaceL};
  padding: ${(props) => props.theme.spaceXl};
  max-width: 320px;
`

const IconWrapper = styled.div`
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${(props) => props.theme.midBorderRadius};
  background-color: ${(props) => props.theme.bgColorSecondary};
  color: ${(props) => props.theme.labelFontColor};
  font-size: 22px;
`

const TextContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${(props) => props.theme.spaceSm};
`

const Title = styled.div`
  font-size: ${(props) => props.theme.fontSm};
  font-weight: 500;
  color: ${(props) => props.theme.primaryFontColor};
`

const FileName = styled.div`
  font-size: ${(props) => props.theme.fontXs};
  color: ${(props) => props.theme.labelFontColor};
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`

const Description = styled.div`
  font-size: ${(props) => props.theme.fontXs};
  color: ${(props) => props.theme.labelFontColor};
  text-align: center;
  line-height: 1.5;
`

const LinkButton = styled.a`
  font-size: ${(props) => props.theme.fontXs};
  color: ${(props) => props.theme.accentColor};
  cursor: pointer;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }
`

export const UnsupportedFileType: React.FC<UnsupportedFileTypeProps> = ({ fileName }) => {
  const handleOpenIssue = () => {
    openUrl('https://github.com/drl990114/MarkFlowy/issues/new/choose')
  }

  return (
    <Container>
      <Content>
        <IconWrapper>
          <i className="ri-file-unknow-line" />
        </IconWrapper>
        <TextContent>
          <Title>{t('file.unsupportedFileType')}</Title>
          {fileName && <FileName>{fileName}</FileName>}
          <Description>{t('file.unsupportedFileTypeDesc')}</Description>
        </TextContent>
        <LinkButton onClick={handleOpenIssue}>
          {t('file.unsupportedFileTypeLink')}
        </LinkButton>
      </Content>
    </Container>
  )
}
