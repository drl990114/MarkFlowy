import { apiClient } from './api-client'
import type { AuthTokens, User } from '@markflowy/types'

export type { AuthTokens, User } from '@markflowy/types'

export interface SendEmailCodeParams {
  email: string
  purpose: string
}

export interface VerifyEmailCodeParams {
  email: string
  code: string
  purpose: string
}

export const authApi = {
  sendEmailCode: async (params: SendEmailCodeParams) => {
    return apiClient.post<{ success: boolean }>('/auth/email/send-code', params)
  },

  verifyEmailCode: async (params: VerifyEmailCodeParams) => {
    return apiClient.post<AuthTokens & { user: User }>('/auth/email/verify-code', params)
  },

  refreshToken: async (refreshToken: string) => {
    return apiClient.post<AuthTokens>('/auth/refresh', { refreshToken })
  },

  logout: async (refreshToken: string) => {
    return apiClient.post<{ success: boolean }>('/auth/logout', { refreshToken })
  },

  getGithubAuthUrl: () => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3200'
    return `${baseUrl}/auth/github`
  },
}
