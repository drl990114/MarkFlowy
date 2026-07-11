import type { ModelMessage, streamText } from 'ai'

/**
 * Provider ids are persisted and cross the renderer/editor boundary. Keep these
 * values stable even when the display name changes.
 */
export const aiProviders = ['openai', 'deepseek', 'google', 'ollama'] as const

export type AIProviderId = (typeof aiProviders)[number]

/** @deprecated Prefer AIProviderId. Kept while editor integrations migrate. */
export type AIProviders = AIProviderId

export type AIModelKey = `${AIProviderId}:${string}`

export type AIModelDescriptor = {
  key: AIModelKey
  providerId: AIProviderId
  modelId: string
  source: 'configured' | 'discovered'
  status: 'ready' | 'unavailable' | 'unknown'
}

export type OpenSettingTarget = {
  category: 'ai'
  providerId?: AIProviderId
}

export type AIProviderSettingKeys = {
  apibase: string
  models: string
  apikey?: string
  requestHeaders?: string
}

export type AIProviderRegistryEntry = {
  id: AIProviderId
  displayName: string
  settingKeys: AIProviderSettingKeys
  modelSource: 'configured' | 'discovered'
  defaultBaseUrl?: string
  runtimeFactory: () => Promise<AIProviderRuntimeHandler>
}

export type AIProviderRuntimeHandler = {
  generateText: (params: AIGenerateTextParams) => Promise<string>
  streamText: (params: AIStreamTextParams) => Promise<ReturnType<typeof streamText>>
}

export const DEFAULT_OLLAMA_API_BASE_URL = 'http://127.0.0.1:11434/api'

/**
 * This registry is the single mapping between persisted settings, display
 * metadata and runtime capabilities. Model factories stay in the lazy runtime
 * module so importing settings does not eagerly bundle provider SDKs.
 */
export const aiProviderRegistry: Record<AIProviderId, AIProviderRegistryEntry> = {
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    settingKeys: {
      apibase: 'extensions_chatgpt_apibase',
      models: 'extensions_chatgpt_models',
      apikey: 'extensions_chatgpt_apikey',
      requestHeaders: 'extensions_chatgpt_request_headers',
    },
    modelSource: 'configured',
    runtimeFactory: async () =>
      (await import('./aiProvidersRuntime')).generateTextHandlerMap.openai,
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek',
    settingKeys: {
      apibase: 'extensions_deepseek_apibase',
      models: 'extensions_deepseek_models',
      apikey: 'extensions_deepseek_apikey',
      requestHeaders: 'extensions_deepseek_request_headers',
    },
    modelSource: 'configured',
    runtimeFactory: async () =>
      (await import('./aiProvidersRuntime')).generateTextHandlerMap.deepseek,
  },
  google: {
    id: 'google',
    displayName: 'Google',
    settingKeys: {
      apibase: 'extensions_google_apibase',
      models: 'extensions_google_models',
      apikey: 'extensions_google_apikey',
      requestHeaders: 'extensions_google_request_headers',
    },
    modelSource: 'configured',
    runtimeFactory: async () =>
      (await import('./aiProvidersRuntime')).generateTextHandlerMap.google,
  },
  ollama: {
    id: 'ollama',
    displayName: 'Ollama',
    settingKeys: {
      apibase: 'extensions_ollama_apibase',
      // Kept solely for persisted-data compatibility. Ollama availability is
      // derived from /api/tags rather than this value.
      models: 'extensions_ollama_models',
      requestHeaders: 'extensions_ollama_request_headers',
    },
    modelSource: 'discovered',
    defaultBaseUrl: DEFAULT_OLLAMA_API_BASE_URL,
    runtimeFactory: async () =>
      (await import('./aiProvidersRuntime')).generateTextHandlerMap.ollama,
  },
}

/** @deprecated Use aiProviderRegistry[provider].settingKeys. */
export const aiProviderSettingKeysMap: Record<AIProviderId, AIProviderSettingKeys> =
  Object.fromEntries(
    aiProviders.map((providerId) => [providerId, aiProviderRegistry[providerId].settingKeys]),
  ) as Record<AIProviderId, AIProviderSettingKeys>

export function isAIProviderId(value: unknown): value is AIProviderId {
  return typeof value === 'string' && (aiProviders as readonly string[]).includes(value)
}

export function normalizeAIProviderId(value: unknown): AIProviderId | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()
  if (normalized === 'chatgpt') return 'openai'
  return isAIProviderId(normalized) ? normalized : undefined
}

export function createAIModelKey(providerId: AIProviderId, modelId: string): AIModelKey {
  const normalizedModelId = modelId.trim()
  if (!normalizedModelId) {
    throw new Error('AI model id cannot be empty')
  }
  return `${providerId}:${normalizedModelId}`
}

export function parseAIModelKey(
  value: unknown,
): { providerId: AIProviderId; modelId: string } | undefined {
  if (typeof value !== 'string') return undefined

  // Model ids may contain colons (for example llama3.2:latest), so only the
  // first colon is structural.
  const separatorIndex = value.indexOf(':')
  if (separatorIndex <= 0) return undefined

  const providerId = normalizeAIProviderId(value.slice(0, separatorIndex))
  const modelId = value.slice(separatorIndex + 1).trim()
  if (!providerId || !modelId) return undefined

  return { providerId, modelId }
}

export function parseConfiguredModels(value: unknown): string[] {
  if (typeof value !== 'string') return []

  const seen = new Set<string>()
  const result: string[] = []
  for (const rawModel of value.split(',')) {
    const model = rawModel.trim()
    if (!model || seen.has(model)) continue
    seen.add(model)
    result.push(model)
  }
  return result
}

export function normalizeRequestHeaders(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, headerValue]) => [key.trim(), String(headerValue).trim()] as const)
      .filter(([key, headerValue]) => key.length > 0 && headerValue.length > 0),
  )
}

function getSettingString(settings: Record<string, unknown>, key?: string): string {
  if (!key) return ''
  const value = settings[key]
  return typeof value === 'string' ? value.trim() : ''
}

export type AIResolvedModelConfig = {
  key: AIModelKey
  providerId: AIProviderId
  modelId: string
  apiBase: string
  apiKey: string
  headers: Record<string, string>
}

export function resolveAIModelConfig(
  modelKey: AIModelKey | string,
  settings: Record<string, unknown>,
): AIResolvedModelConfig {
  const parsed = parseAIModelKey(modelKey)
  if (!parsed) throw new Error(`Invalid AI model key: ${String(modelKey)}`)

  const registration = aiProviderRegistry[parsed.providerId]
  const keys = registration.settingKeys
  const configuredBase = getSettingString(settings, keys.apibase)
  const apiBase =
    parsed.providerId === 'ollama' ? normalizeOllamaApiBaseUrl(configuredBase) : configuredBase

  return {
    key: createAIModelKey(parsed.providerId, parsed.modelId),
    providerId: parsed.providerId,
    modelId: parsed.modelId,
    apiBase,
    apiKey: getSettingString(settings, keys.apikey),
    headers: normalizeRequestHeaders(settings[keys.requestHeaders ?? '']),
  }
}

export function isCloudProviderConfigured(
  providerId: Exclude<AIProviderId, 'ollama'>,
  settings: Record<string, unknown>,
): boolean {
  const registration = aiProviderRegistry[providerId]
  const keys = registration.settingKeys
  const models = parseConfiguredModels(settings[keys.models])
  if (models.length === 0) return false

  const hasApiKey = Boolean(getSettingString(settings, keys.apikey))
  const hasCustomBaseUrl = Boolean(getSettingString(settings, keys.apibase))
  const headers = normalizeRequestHeaders(settings[keys.requestHeaders ?? ''])
  return hasApiKey || hasCustomBaseUrl || Object.keys(headers).length > 0
}

export function normalizeOllamaApiBaseUrl(value: unknown): string {
  const rawValue = typeof value === 'string' ? value.trim() : ''
  if (!rawValue) return DEFAULT_OLLAMA_API_BASE_URL

  const withoutTrailingSlash = rawValue.replace(/\/+$/, '')
  return /\/api$/i.test(withoutTrailingSlash) ? withoutTrailingSlash : `${withoutTrailingSlash}/api`
}

export type AIGenerateTextParams = {
  sdkProvider: AIProviderId
  url: string
  apiKey: string
  model: string
  messages: ModelMessage[]
  headers?: Record<string, string>
  abortSignal?: AbortSignal
}

export type AIStreamTextParams = Parameters<typeof streamText>[0] & {
  sdkProvider: AIProviderId
  url: string
  apiKey: string
  model: string
  messages: ModelMessage[]
  headers?: Record<string, string>
  abortSignal?: AbortSignal
}
