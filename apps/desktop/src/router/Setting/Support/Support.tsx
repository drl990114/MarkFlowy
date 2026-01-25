import { openUrl } from '@tauri-apps/plugin-opener'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { Button } from 'zens'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 16px;
`

const SupportItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const Title = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: ${(props) => props.theme.primaryFontColor};
`

const Description = styled.div`
  font-size: 14px;
  color: ${(props) => props.theme.labelFontColor};
  line-height: 1.5;
`

const ButtonContainer = styled.div`
  margin-top: 8px;
`

export function Support() {
  const { t } = useTranslation()

  const handleOpenGithubStar = () => {
    openUrl('https://github.com/drl990114/MarkFlowy')
  }

  const handleOpenGithubIssue = () => {
    openUrl('https://github.com/drl990114/MarkFlowy/issues/new/choose')
  }

  return (
    <Container>
      <SupportItem>
        <Title>{t('settings.support.github_star')}</Title>
        <Description>{t('settings.support.github_star_desc')}</Description>
        <ButtonContainer>
          <Button onClick={handleOpenGithubStar}>
            <i className="ri-github-fill" style={{ marginRight: '8px' }} />
            GitHub Star
          </Button>
        </ButtonContainer>
      </SupportItem>

      <SupportItem>
        <Title>{t('settings.support.github_issue')}</Title>
        <Description>{t('settings.support.github_issue_desc')}</Description>
        <ButtonContainer>
          <Button onClick={handleOpenGithubIssue}>
            <i className="ri-question-line" style={{ marginRight: '8px' }} />
            {t('settings.support.github_issue')}
          </Button>
        </ButtonContainer>
      </SupportItem>
    </Container>
  )
}
