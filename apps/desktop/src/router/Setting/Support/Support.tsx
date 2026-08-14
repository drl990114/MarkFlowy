import { openUrl } from '@tauri-apps/plugin-opener'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'

const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0 16px;
  background-color: var(--mf-card);
  border: 1px solid var(--mf-border);
  border-radius: var(--mf-radius);
  box-sizing: border-box;
`

const SupportItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 0;
  border-bottom: 1px solid var(--mf-border);

  &:last-child {
    border-bottom: 0;
  }
`

const Title = styled.div`
  font-size: var(--mf-ui-font-body);
  font-weight: 600;
  line-height: var(--mf-ui-line-height-body);
  color: ${(props) => props.theme.primaryFontColor};
`

const Description = styled.div`
  font-size: var(--mf-ui-font-control);
  color: ${(props) => props.theme.labelFontColor};
  line-height: var(--mf-ui-line-height-control);
`

const ButtonContainer = styled.div`
  margin-top: 4px;
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
          <Button size='sm' onClick={handleOpenGithubStar}>
            <i aria-hidden className='ri-github-fill' />
            GitHub Star
          </Button>
        </ButtonContainer>
      </SupportItem>

      <SupportItem>
        <Title>{t('settings.support.github_issue')}</Title>
        <Description>{t('settings.support.github_issue_desc')}</Description>
        <ButtonContainer>
          <Button size='sm' variant='outline' onClick={handleOpenGithubIssue}>
            <i aria-hidden className='ri-question-line' />
            {t('settings.support.github_issue')}
          </Button>
        </ButtonContainer>
      </SupportItem>
    </Container>
  )
}
