import type { AuthSession } from '@markflowy/types'

let accessToken: string | null = null

export function getAuthAccessToken() {
  return accessToken
}

export function setAuthAccessToken(token: string) {
  accessToken = token
}

export function saveAuthSession(session: AuthSession) {
  setAuthAccessToken(session.accessToken)
  localStorage.setItem('user', JSON.stringify(session.user))
}

export function clearAuthSession() {
  accessToken = null
  // Remove pre-release localStorage credentials from the previous session implementation.
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
}
