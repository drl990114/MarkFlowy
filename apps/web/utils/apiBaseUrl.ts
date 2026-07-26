const API_BASE_URL = '/api/cloud'

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function buildApiUrl(endpoint: string) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${getApiBaseUrl()}${path}`
}
