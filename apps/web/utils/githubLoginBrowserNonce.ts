const GITHUB_LOGIN_BROWSER_NONCE_STORAGE_KEY = 'markflowy:auth:github:browser-nonce'
const GITHUB_LOGIN_BROWSER_NONCE_BYTE_LENGTH = 32
const GITHUB_LOGIN_BROWSER_NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/

function toBase64Url(bytes: Uint8Array) {
  let binary = ''

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function createGitHubLoginBrowserNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(GITHUB_LOGIN_BROWSER_NONCE_BYTE_LENGTH))
  const nonce = toBase64Url(bytes)
  sessionStorage.setItem(GITHUB_LOGIN_BROWSER_NONCE_STORAGE_KEY, nonce)
  return nonce
}

export function getGitHubLoginBrowserNonce() {
  try {
    const nonce = sessionStorage.getItem(GITHUB_LOGIN_BROWSER_NONCE_STORAGE_KEY)
    return nonce && GITHUB_LOGIN_BROWSER_NONCE_PATTERN.test(nonce) ? nonce : null
  } catch {
    return null
  }
}

export function clearGitHubLoginBrowserNonce() {
  try {
    sessionStorage.removeItem(GITHUB_LOGIN_BROWSER_NONCE_STORAGE_KEY)
  } catch {
    // A blocked storage context already prevents this browser from completing the bound login.
  }
}
