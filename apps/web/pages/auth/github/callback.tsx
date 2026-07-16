import { useEffect, useRef, useState } from 'react'
import type { AuthSession } from '@markflowy/types'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { serverSideTranslations } from 'next-i18next/serverSideTranslations'
import { useTranslation } from 'next-i18next'
import styled from 'styled-components'
import SeoHead from '../../../components/SeoHead'
import { githubService } from '../../../features/githubWorkspace/services/githubService'
import { saveAuthSession } from '../../../utils/authSession'
import {
  clearGitHubLoginBrowserNonce,
  getGitHubLoginBrowserNonce,
} from '../../../utils/githubLoginBrowserNonce'
import rem from '../../../utils/rem'

export default function GitHubAuthCallbackPage() {
  const router = useRouter()
  const { t } = useTranslation('common')
  const exchangeRef = useRef<{
    ticket: string
    returnTo: string
    promise: Promise<AuthSession>
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!router.isReady) return

    if (!exchangeRef.current) {
      const fragment = new URLSearchParams(window.location.hash.slice(1))
      const ticket = fragment.get('ticket')
      const browserNonce = getGitHubLoginBrowserNonce()
      const rawReturnTo = fragment.get('return_to')
      const returnTo =
        rawReturnTo?.startsWith('/') && !rawReturnTo.startsWith('//') && !rawReturnTo.includes('\\')
          ? rawReturnTo
          : '/workspace'

      window.history.replaceState(window.history.state, '', window.location.pathname)

      if (!ticket || !browserNonce) {
        clearGitHubLoginBrowserNonce()
        setError(t('auth.githubCallbackError'))
        return
      }

      exchangeRef.current = {
        ticket,
        returnTo,
        promise: githubService
          .exchangeLoginTicket(ticket, browserNonce)
          .finally(clearGitHubLoginBrowserNonce),
      }
    }
    const exchange = exchangeRef.current

    let cancelled = false

    const exchangeTicket = async () => {
      try {
        const session = await exchange.promise
        if (cancelled) return

        saveAuthSession(session)
        await router.replace(exchange.returnTo)
      } catch (caughtError) {
        if (cancelled) return

        setError(
          caughtError instanceof Error && caughtError.message
            ? caughtError.message
            : t('auth.githubCallbackError'),
        )
      }
    }

    void exchangeTicket()

    return () => {
      cancelled = true
    }
  }, [router, t])

  return (
    <>
      <SeoHead title={`${t('auth.githubCompleting')} - MarkFlowy`} />
      <CallbackLayout>
        <CallbackCard aria-live='polite'>
          <GitHubIcon className='ri-github-fill' aria-hidden='true' />
          <CallbackTitle>
            {error ? t('auth.githubCallbackFailed') : t('auth.githubCompleting')}
          </CallbackTitle>
          {error ? (
            <>
              <ErrorMessage>{error}</ErrorMessage>
              <BackLink href='/auth'>{t('auth.backToSignIn')}</BackLink>
            </>
          ) : (
            <LoadingSpinner aria-hidden='true' />
          )}
        </CallbackCard>
      </CallbackLayout>
    </>
  )
}

const CallbackLayout = styled.main`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${rem(24)};
  background: ${(props) => props.theme.bgColor};
`

const CallbackCard = styled.div`
  width: 100%;
  max-width: ${rem(360)};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${rem(14)};
  padding: ${rem(28)};
  background: ${(props) => props.theme.bgColorSecondary};
  border: 1px solid ${(props) => props.theme.borderColor};
  border-radius: ${rem(8)};
  text-align: center;
`

const GitHubIcon = styled.i`
  font-size: ${rem(32)};
  color: ${(props) => props.theme.primaryFontColor};
`

const CallbackTitle = styled.h1`
  margin: 0;
  font-size: ${rem(20)};
  line-height: 1.35;
`

const ErrorMessage = styled.p`
  margin: 0;
  color: #ff7875;
  font-size: ${rem(13)};
  line-height: 1.55;
`

const BackLink = styled(Link)`
  color: ${(props) => props.theme.accentColor};
  font-size: ${rem(14)};
  font-weight: 600;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 3px;
  }
`

const LoadingSpinner = styled.div`
  width: ${rem(20)};
  height: ${rem(20)};
  border: 2px solid ${(props) => props.theme.borderColor};
  border-top-color: ${(props) => props.theme.accentColor};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
`

export const getStaticProps = async ({ locale }: { locale: string }) => ({
  props: {
    ...(await serverSideTranslations(locale || 'en', ['common'])),
  },
})
