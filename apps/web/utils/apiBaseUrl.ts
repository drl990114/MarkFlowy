const LOCAL_PREVIEW_API_URL = 'https://preview-markflowy-cloud.drl990114.workers.dev'
const PRODUCTION_API_URL = 'https://markflowy-cloud.drl990114.workers.dev'

function trimTrailingSlash(url: string) {
  return url.replace(/\/+$/, '')
}

export function getApiBaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_API_URL?.trim()

  if (configuredUrl) {
    return trimTrailingSlash(configuredUrl)
  }

  return process.env.NODE_ENV === 'development' ? LOCAL_PREVIEW_API_URL : PRODUCTION_API_URL
}

export function buildApiUrl(endpoint: string) {
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${getApiBaseUrl()}${path}`
}
