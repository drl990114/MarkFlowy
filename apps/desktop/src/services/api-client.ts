import { fetch } from '@tauri-apps/plugin-http'
import { logger } from '@/helper/logger'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3200'

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

class ApiClient {
  private baseUrl: string
  private token: string | null = null

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  setToken(token: string | null) {
    this.token = token
  }

  getToken() {
    return this.token
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

  private async request<T>(
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

      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`
      }

      const response = await fetch(url, {
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
      logger.error('API request error:', error)
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

export const apiClient = new ApiClient(API_BASE_URL)
