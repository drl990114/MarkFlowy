import { queryOptions } from '@tanstack/react-query'
import { fetch as nativeFetch } from '@tauri-apps/plugin-http'
import { parseThemeDocument } from '@markflowy/theme/semantic'

export interface ThemeItem {
  id: string
  name: string
  author: string
  url: string
  version: string
}

export class ThemeCatalogMismatchError extends Error {
  constructor() {
    super('The theme ID does not match the community catalog.')
  }
}

export function communityThemeQueryOptions(item: ThemeItem) {
  return queryOptions({
    queryKey: ['community-theme', item.id, item.version, item.url],
    queryFn: async ({ signal }) => {
      const controller = new AbortController()
      const abort = () => controller.abort(signal.reason)
      if (signal.aborted) abort()
      else signal.addEventListener('abort', abort, { once: true })
      const timeout = setTimeout(
        () => controller.abort(new DOMException('Theme download timed out', 'TimeoutError')),
        15_000,
      )
      try {
        const response = await nativeFetch(item.url, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const document = parseThemeDocument(await response.json())
        if (document.id !== item.id) throw new ThemeCatalogMismatchError()
        return document
      } finally {
        clearTimeout(timeout)
        signal.removeEventListener('abort', abort)
      }
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    // Tauri's native network request should determine connectivity.
    networkMode: 'always',
  })
}
