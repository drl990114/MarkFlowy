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

export const githubService = {
  startLogin(returnTo: string, browserNonce: string) {
    return apiClient.post<GitHubAuthorizeResponse>(
      '/auth/github/start',
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

  startConnection() {
    return apiClient.post<GitHubAuthorizeResponse>('/github/connection/start')
  },

  deleteConnection() {
    return apiClient.delete<{ success: boolean }>('/github/connection')
  },

  startInstallation() {
    return apiClient.post<GitHubAuthorizeResponse>('/github/installations/start')
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
