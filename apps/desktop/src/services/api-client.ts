import { fetch } from '@tauri-apps/plugin-http'
import { ApiClient, createMemoryTokenStorage, type FetchAdapter } from '@markflowy/api-client'
import { logger } from '@/helper/logger'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3200'

const tauriFetchAdapter: FetchAdapter = {
  fetch: (url, init) => fetch(url, init as any),
}

const tokenStorage = createMemoryTokenStorage()

class DesktopApiClient extends ApiClient {
  constructor() {
    super({ baseUrl: API_BASE_URL, fetchAdapter: tauriFetchAdapter, tokenStorage })
  }

  protected async request<T>(
    method: string,
    path: string,
    data?: any,
    config?: any,
  ): Promise<any> {
    const result = await super.request<T>(method, path, data, config)
    if (result.error) {
      logger.error('API request error:', result.error)
    }
    return result
  }
}

export const apiClient = new DesktopApiClient()

export type { ApiResponse, RequestConfig } from '@markflowy/api-client'
