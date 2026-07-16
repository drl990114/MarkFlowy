import type { MfTheme } from '@markflowy/theme'

export type MF_CONTEXT = {
  theme: {
    registerTheme: (theme: MfTheme) => void
  }
}

export type Extension = {
  name: string
  version: string
  description: string
}

export interface GitHubConfig {
  hasToken: boolean
  username?: string
  createdAt?: string
}

export interface GitHubInstallation {
  installationId: string
  accountLogin: string
  accountType: string
  repositorySelection: 'all' | 'selected'
  createdAt: string
}

export interface GitHubConnectionStatus {
  linked: boolean
  login?: string
  avatarUrl?: string
  linkedAt?: string
  installations: GitHubInstallation[]
}

export interface User {
  id: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthSession {
  accessToken: string
  user: User
}
