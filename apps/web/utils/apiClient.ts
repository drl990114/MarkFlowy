interface ApiClientOptions {
  headers?: Record<string, string>
  skipAuth?: boolean
}

interface RequestConfig extends RequestInit {
  skipAuth?: boolean
}

interface RefreshTokenResponse {
  accessToken: string
  refreshToken: string
}

class ApiClient {
  private baseUrl: string
  private isRefreshing = false
  private refreshPromise: Promise<RefreshTokenResponse | null> | null = null

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200'
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('accessToken')
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('refreshToken')
  }

  private setTokens(accessToken: string, refreshToken: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
    }
  }

  private clearAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('user')
      window.location.href = '/auth'
    }
  }

  private async refreshAccessToken(): Promise<RefreshTokenResponse | null> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) {
      return null
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        credentials: 'include',
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      this.setTokens(data.accessToken, data.refreshToken)
      return data
    } catch {
      return null
    }
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
        if (this.isRefreshing) {
          if (this.refreshPromise) {
            const result = await this.refreshPromise
            if (result) {
              return retryRequest()
            } else {
              this.clearAuth()
              throw new Error('Session expired')
            }
          }
        } else {
          this.isRefreshing = true
          this.refreshPromise = this.refreshAccessToken()
          const result = await this.refreshPromise
          this.isRefreshing = false
          this.refreshPromise = null

          if (result) {
            return retryRequest()
          } else {
            this.clearAuth()
            throw new Error('Session expired')
          }
        }
      }

      throw new Error(errorMessage)
    }

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      return response.json()
    }
    
    return response.text() as Promise<T>
  }

  async request<T = any>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { skipAuth = false, headers: customHeaders = {}, ...fetchConfig } = config
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...customHeaders,
    }

    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
      }
    }

    const makeRequest = async (): Promise<Response> => {
      if (!skipAuth) {
        const token = this.getAuthToken()
        if (token) {
          ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
        }
      }

      return fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchConfig,
        headers,
        credentials: 'include',
      })
    }

    const response = await makeRequest()
    return this.handleResponse<T>(response, () => makeRequest().then(r => this.handleResponse<T>(r)))
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
    
    const headers: Record<string, string> = {
      ...customHeaders,
    }

    if (!skipAuth) {
      const token = this.getAuthToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
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
