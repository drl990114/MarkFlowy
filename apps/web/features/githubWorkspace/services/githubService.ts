import { apiClient } from '../../../utils/apiClient'
import type { AuthSession, GitHubConnectionStatus } from '@markflowy/types'

export interface GitHubRepo {
  id: string
  installationId: string
  full_name: string
  name: string
  owner: { login: string }
  description: string | null
  private: boolean
  updated_at: string
}

export interface ImportedGitHubWorkspace {
  id: string
  name: string
  type: 'GITHUB'
  sourceUrl?: string | null
}

interface GitHubAuthorizeResponse {
  authorizeUrl: string
}

function withLocale(endpoint: string, locale?: string) {
  return locale ? `${endpoint}?locale=${encodeURIComponent(locale)}` : endpoint
}

export const githubService = {
  startLogin(returnTo: string, browserNonce: string, locale?: string) {
    return apiClient.post<GitHubAuthorizeResponse>(
      withLocale('/auth/github/start', locale),
      { returnTo, browserNonce },
      { skipAuth: true },
    )
  },

  exchangeLoginTicket(ticket: string, browserNonce: string) {
    return apiClient.post<AuthSession>(
      '/auth/github/exchange',
      { ticket, browserNonce },
      { skipAuth: true },
    )
  },

  getConnection() {
    return apiClient.get<GitHubConnectionStatus>('/github/connection')
  },

  startConnection(locale?: string) {
    return apiClient.post<GitHubAuthorizeResponse>(
      withLocale('/github/connection/start', locale),
    )
  },

  deleteConnection() {
    return apiClient.delete<{ success: boolean }>('/github/connection')
  },

  startInstallation(returnTo?: string, locale?: string) {
    return apiClient.post<GitHubAuthorizeResponse>(
      withLocale('/github/installations/start', locale),
      { returnTo },
    )
  },

  deleteInstallation(installationId: string) {
    return apiClient.delete<{ success: boolean }>(
      `/github/installations/${encodeURIComponent(installationId)}`,
    )
  },

  listRepos(page = 1, perPage = 30) {
    return apiClient.get<GitHubRepo[]>(`/github/repos?page=${page}&per_page=${perPage}`)
  },

  importRepository(repositoryId: string, installationId: string) {
    return apiClient.post<ImportedGitHubWorkspace>('/workspaces/import/github', {
      repositoryId,
      installationId,
    })
  },
}
