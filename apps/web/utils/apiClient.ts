interface ApiClientOptions {
  headers?: Record<string, string>
  skipAuth?: boolean
}

interface RequestConfig extends RequestInit {
  skipAuth?: boolean
}

class ApiClient {
  private baseUrl: string

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200'
  }

  private getAuthToken(): string | null {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('accessToken')
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let errorMessage = 'Request failed'
      
      try {
        const errorData = await response.json()
        errorMessage = errorData.message || errorData.error || errorMessage
      } catch {
        errorMessage = response.statusText || errorMessage
      }

      if (response.status === 401) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          localStorage.removeItem('user')
          window.location.href = '/auth'
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

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...fetchConfig,
      headers,
      credentials: 'include',
    })

    return this.handleResponse<T>(response)
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
