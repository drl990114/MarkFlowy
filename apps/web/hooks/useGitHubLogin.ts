import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { githubService } from 'features/githubWorkspace/services/githubService'
import { redirectToGitHub } from 'utils/githubAuthorization'
import {
  clearGitHubLoginBrowserNonce,
  createGitHubLoginBrowserNonce,
} from 'utils/githubLoginBrowserNonce'

export function useGitHubLogin(fallbackError: string, accountLinkRequiredError: string) {
  const router = useRouter()
  const startingRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (router.isReady && typeof router.query.github_error === 'string') {
      clearGitHubLoginBrowserNonce()
      startingRef.current = false
      setLoading(false)
      setError(
        router.query.github_error === 'account_exists_link_required'
          ? accountLinkRequiredError
          : fallbackError,
      )
    }
  }, [accountLinkRequiredError, fallbackError, router.isReady, router.query.github_error])

  const startLogin = async () => {
    if (startingRef.current) return

    startingRef.current = true
    setLoading(true)
    setError('')

    try {
      const browserNonce = createGitHubLoginBrowserNonce()
      const locale = router.locale === router.defaultLocale ? undefined : router.locale
      const { authorizeUrl } = await githubService.startLogin('/workspace', browserNonce, locale)
      redirectToGitHub(authorizeUrl)
    } catch (caughtError) {
      clearGitHubLoginBrowserNonce()
      startingRef.current = false
      setError(
        caughtError instanceof Error && caughtError.message ? caughtError.message : fallbackError,
      )
      setLoading(false)
    }
  }

  return {
    loading,
    error,
    startLogin,
  }
}
