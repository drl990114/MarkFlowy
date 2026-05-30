export interface ApiResponse<T = any> {
  data?: T
  error?: {
    message: string
    statusCode: number
  }
}

export interface RequestConfig {
  headers?: Record<string, string>
  params?: Record<string, any>
}

export interface FetchAdapter {
  fetch(url: string, init: RequestInit): Promise<Response>
}

export type TokenStorage = {
  getToken: () => string | null
  setToken: (token: string | null) => void
}

export class ApiClient {
  private baseUrl: string
  private fetchAdapter: FetchAdapter
  private tokenStorage: TokenStorage

  constructor(options: { baseUrl: string; fetchAdapter: FetchAdapter; tokenStorage: TokenStorage }) {
    this.baseUrl = options.baseUrl
    this.fetchAdapter = options.fetchAdapter
    this.tokenStorage = options.tokenStorage
  }

  setToken(token: string | null) {
    this.tokenStorage.setToken(token)
  }

  getToken() {
    return this.tokenStorage.getToken()
  }

  private buildUrl(path: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value))
        }
      })
    }
    return url.toString()
  }

  protected async request<T>(
    method: string,
    path: string,
    data?: any,
    config?: RequestConfig,
  ): Promise<ApiResponse<T>> {
    try {
      const url = this.buildUrl(path, config?.params)
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...config?.headers,
      }

      const token = this.tokenStorage.getToken()
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await this.fetchAdapter.fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
      })

      const responseData = await response.json()

      if (!response.ok) {
        return {
          error: {
            message: responseData.message || 'Request failed',
            statusCode: response.status,
          },
        }
      }

      return { data: responseData }
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Network error',
          statusCode: 0,
        },
      }
    }
  }

  async get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, config)
  }

  async post<T>(path: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, data, config)
  }

  async put<T>(path: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, data, config)
  }

  async patch<T>(path: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, data, config)
  }

  async delete<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, config)
  }
}

export const createBrowserFetchAdapter = (): FetchAdapter => ({
  fetch: (url, init) => globalThis.fetch(url, init),
})

export const createMemoryTokenStorage = (): TokenStorage => {
  let token: string | null = null
  return {
    getToken: () => token,
    setToken: (t) => {
      token = t
    },
  }
}
