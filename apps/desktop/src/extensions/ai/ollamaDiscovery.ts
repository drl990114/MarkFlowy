import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { normalizeOllamaApiBaseUrl, normalizeRequestHeaders } from './aiProvidersService'

const DEFAULT_OLLAMA_TIMEOUT_MS = 6_000
const DEFAULT_OLLAMA_SHOW_CONCURRENCY = 4

export const OLLAMA_DISCOVERY_STALE_TIME_MS = 30_000

export type OllamaDiscoveryStatus = 'idle' | 'loading' | 'success' | 'error'

export type OllamaDiscoveredModel = {
  modelId: string
  capability: 'completion' | 'unknown'
}

export type OllamaDiscoveryResult = {
  apiBaseUrl: string
  models: OllamaDiscoveredModel[]
  discoveredAt: number
}

export type OllamaDiscoveryOptions = {
  apiBaseUrl?: string
  headers?: Record<string, string>
  signal?: AbortSignal
  timeoutMs?: number
  showConcurrency?: number
  fetchFn?: typeof fetch
}

type OllamaTagsResponse = {
  models?: Array<{ name?: unknown; model?: unknown }>
}

type OllamaShowResponse = {
  capabilities?: unknown
}

function createCombinedAbortController(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(signal?.reason)

  if (signal?.aborted) forwardAbort()
  else signal?.addEventListener('abort', forwardAbort, { once: true })

  const timeoutId = setTimeout(
    () => controller.abort(new DOMException('Ollama request timed out', 'TimeoutError')),
    timeoutMs,
  )

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', forwardAbort)
    },
  }
}

async function readJsonResponse<T>(response: Response, endpoint: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`Ollama ${endpoint} failed with HTTP ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function inspectOllamaModel(
  modelId: string,
  apiBaseUrl: string,
  headers: Record<string, string>,
  signal: AbortSignal,
  fetchFn: typeof fetch,
): Promise<OllamaDiscoveredModel | undefined> {
  try {
    const response = await fetchFn(`${apiBaseUrl}/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ model: modelId }),
      signal,
    })
    const data = await readJsonResponse<OllamaShowResponse>(response, '/api/show')

    // Older Ollama versions do not expose capabilities. Keep those models;
    // only an explicit capability list without completion is filtered out.
    if (!Array.isArray(data.capabilities)) {
      return { modelId, capability: 'unknown' }
    }

    return data.capabilities.includes('completion')
      ? { modelId, capability: 'completion' }
      : undefined
  } catch (error) {
    if (signal.aborted) throw error
    return { modelId, capability: 'unknown' }
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, worker),
  )
  return results
}

export async function discoverOllamaModels(
  options: OllamaDiscoveryOptions = {},
): Promise<OllamaDiscoveryResult> {
  const apiBaseUrl = normalizeOllamaApiBaseUrl(options.apiBaseUrl)
  const headers = normalizeRequestHeaders(options.headers)
  const fetchFn = options.fetchFn ?? (tauriFetch as typeof fetch)
  const { signal, dispose } = createCombinedAbortController(
    options.signal,
    options.timeoutMs ?? DEFAULT_OLLAMA_TIMEOUT_MS,
  )

  try {
    const response = await fetchFn(`${apiBaseUrl}/tags`, { headers, signal })
    const data = await readJsonResponse<OllamaTagsResponse>(response, '/api/tags')

    const modelIds: string[] = []
    const seen = new Set<string>()
    for (const model of data.models ?? []) {
      const modelId =
        typeof model.name === 'string'
          ? model.name.trim()
          : typeof model.model === 'string'
            ? model.model.trim()
            : ''
      if (!modelId || seen.has(modelId)) continue
      seen.add(modelId)
      modelIds.push(modelId)
    }

    const inspected = await mapWithConcurrency(
      modelIds,
      options.showConcurrency ?? DEFAULT_OLLAMA_SHOW_CONCURRENCY,
      (modelId) => inspectOllamaModel(modelId, apiBaseUrl, headers, signal, fetchFn),
    )

    return {
      apiBaseUrl,
      models: inspected.filter((model): model is OllamaDiscoveredModel => Boolean(model)),
      discoveredAt: Date.now(),
    }
  } finally {
    dispose()
  }
}

export function getOllamaDiscoveryQueryKey(
  apiBaseUrl: unknown,
  headers: unknown,
): readonly ['ai', 'ollama-models', string, string] {
  const normalizedHeaders = normalizeRequestHeaders(headers)
  const stableHeaders = JSON.stringify(
    Object.fromEntries(Object.entries(normalizedHeaders).sort(([a], [b]) => a.localeCompare(b))),
  )
  return [
    'ai',
    'ollama-models',
    normalizeOllamaApiBaseUrl(apiBaseUrl),
    hashQueryValue(stableHeaders),
  ] as const
}

function hashQueryValue(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
