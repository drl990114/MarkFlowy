import { getApiBaseUrl } from './apiBaseUrl'
import {
  clearAuthSession,
  getAuthAccessToken,
  setAuthAccessToken,
} from './authSession'

interface ApiClientOptions {
  headers?: Record<string, string>
  skipAuth?: boolean
}

interface RequestConfig extends RequestInit {
  skipAuth?: boolean
}

interface RefreshTokenResponse {
  accessToken: string
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}

class ApiClient {
  private baseUrl: string
  private isRefreshing = false
  private refreshPromise: Promise<RefreshTokenResponse | null> | null = null

  constructor() {
    this.baseUrl = getApiBaseUrl()
  }

  private getAuthToken(): string | null {
    return typeof window === 'undefined' ? null : getAuthAccessToken()
  }

  private getTokenExpiry(token: string): number | null {
    try {
      const [, payload] = token.split('.')
      if (!payload) return null

      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
      const decoded = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
      return typeof decoded.exp === 'number' ? decoded.exp : null
    } catch {
      return null
    }
  }

  private shouldRefreshAccessToken(): boolean {
    const accessToken = this.getAuthToken()
    if (!accessToken) return true

    const expiresAt = this.getTokenExpiry(accessToken)
    if (!expiresAt) return true

    return expiresAt <= Math.floor(Date.now() / 1000) + 60
  }

  private isRefreshTokenResponse(data: unknown): data is RefreshTokenResponse {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof (data as RefreshTokenResponse).accessToken === 'string'
    )
  }

  private setAccessToken(accessToken: string) {
    if (typeof window !== 'undefined') {
      setAuthAccessToken(accessToken)
    }
  }

  private clearAuth() {
    if (typeof window !== 'undefined') {
      clearAuthSession()
      window.location.href = '/auth'
    }
  }

  private async refreshAccessToken(): Promise<RefreshTokenResponse | null> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        credentials: 'include',
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      if (!this.isRefreshTokenResponse(data)) {
        return null
      }

      this.setAccessToken(data.accessToken)
      return data
    } catch {
      return null
    }
  }

  private async refreshWithinTabLock(force: boolean): Promise<RefreshTokenResponse | null> {
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise
    }

    if (!force && !this.shouldRefreshAccessToken()) {
      const accessToken = this.getAuthToken()
      return accessToken ? { accessToken } : null
    }

    this.isRefreshing = true
    this.refreshPromise = this.refreshAccessToken()

    try {
      return await this.refreshPromise
    } finally {
      this.isRefreshing = false
      this.refreshPromise = null
    }
  }

  private async refreshWithLock(force = false): Promise<RefreshTokenResponse | null> {
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('markflowy-auth-refresh', () =>
        this.refreshWithinTabLock(force),
      )
    }

    return this.refreshWithinTabLock(force)
  }

  private async ensureFreshAccessToken() {
    if (!this.shouldRefreshAccessToken()) return
    await this.refreshWithLock()
  }

  async restoreSession() {
    return Boolean(await this.refreshWithLock())
  }

  async logoutSession() {
    const logout = async () => {
      const response = await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        credentials: 'include',
      })
      return this.handleResponse<{ success: boolean }>(response)
    }

    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request('markflowy-auth-refresh', logout)
    }

    return logout()
  }

  private async handleResponse<T>(response: Response, retryRequest?: () => Promise<T>): Promise<T> {
    if (!response.ok) {
      let errorMessage = 'Request failed'

      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }

      if (response.status === 401 && retryRequest) {
        const result = await this.refreshWithLock(true)
        if (result) {
          return retryRequest()
        }

        this.clearAuth()
        throw new Error('Session expired')
      }

      throw new ApiClientError(errorMessage, response.status)
    }

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }

    return response.text() as Promise<T>
  }

  async request<T = any>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { skipAuth = false, headers: customHeaders = {}, ...fetchConfig } = config

    if (!skipAuth) {
      await this.ensureFreshAccessToken()
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders,
    }

    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        ;(headers as Record<string, string>).Authorization = `Bearer ${token}`
      }
    }

    const makeRequest = async (): Promise<Response> => {
      if (!skipAuth) {
        const token = this.getAuthToken()
        if (token) {
          ;(headers as Record<string, string>).Authorization = `Bearer ${token}`
        }
      }

      return fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchConfig,
        headers,
        credentials: 'include',
      })
    }

    const response = await makeRequest()
    return this.handleResponse<T>(response, () =>
      makeRequest().then((r) => this.handleResponse<T>(r)),
    )
  }

  async get<T = any>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'GET',
      ...options,
    })
  }

  async post<T = any>(endpoint: string, data?: any, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
      ...options,
    })
  }

  async put<T = any>(endpoint: string, data?: any, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
      ...options,
    })
  }

  async patch<T = any>(endpoint: string, data?: any, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
      ...options,
    })
  }

  async delete<T = any>(endpoint: string, options?: ApiClientOptions): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
      ...options,
    })
  }

  async upload<T = any>(endpoint: string, file: File, options?: ApiClientOptions): Promise<T> {
    const formData = new FormData()
    formData.append('file', file)

    const { skipAuth = false, headers: customHeaders = {} } = options || {}

    if (!skipAuth) {
      await this.ensureFreshAccessToken()
    }

    const headers: Record<string, string> = {
      ...customHeaders,
    }

    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        headers.Authorization = `Bearer ${token}`
      }
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    })

    return this.handleResponse<T>(response)
  }
}

export const apiClient = new ApiClient()
export type { ApiClientOptions }
