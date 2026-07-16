const GITHUB_ORIGIN = 'https://github.com'

export function redirectToGitHub(authorizeUrl: string) {
  const url = new URL(authorizeUrl)

  if (url.origin !== GITHUB_ORIGIN) {
    throw new Error('Invalid GitHub authorization URL')
  }

  const isOAuthAuthorization = url.pathname === '/login/oauth/authorize'
  const isInstallationAuthorization = /^\/apps\/[a-z0-9-]+\/installations\/new$/i.test(
    url.pathname,
  )

  if (!isOAuthAuthorization && !isInstallationAuthorization) {
    throw new Error('Invalid GitHub authorization path')
  }

  window.location.assign(url.toString())
}
