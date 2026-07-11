import { describe, expect, it } from 'vitest'
import {
  createAIModelKey,
  isCloudProviderConfigured,
  normalizeAIProviderId,
  normalizeOllamaApiBaseUrl,
  parseAIModelKey,
  parseConfiguredModels,
  resolveAIModelConfig,
} from './aiProvidersService'

describe('AI provider registry helpers', () => {
  it('trims, removes empty models and de-duplicates without reordering', () => {
    expect(parseConfiguredModels(' gpt-4o, ,gpt-4o-mini,gpt-4o, gpt-4o-mini ')).toEqual([
      'gpt-4o',
      'gpt-4o-mini',
    ])
  })

  it('round-trips compound keys whose model id contains colons', () => {
    const key = createAIModelKey('ollama', 'llama3.2:latest')
    expect(key).toBe('ollama:llama3.2:latest')
    expect(parseAIModelKey(key)).toEqual({
      providerId: 'ollama',
      modelId: 'llama3.2:latest',
    })
  })

  it('normalizes the legacy ChatGPT provider name', () => {
    expect(normalizeAIProviderId('ChatGPT')).toBe('openai')
    expect(normalizeAIProviderId(' openai ')).toBe('openai')
    expect(normalizeAIProviderId('unknown')).toBeUndefined()
  })

  it('requires cloud models and at least one connection setting', () => {
    const base = { extensions_chatgpt_models: 'gpt-4o' }
    expect(isCloudProviderConfigured('openai', base)).toBe(false)
    expect(
      isCloudProviderConfigured('openai', {
        ...base,
        extensions_chatgpt_apikey: 'key',
      }),
    ).toBe(true)
    expect(
      isCloudProviderConfigured('openai', {
        ...base,
        extensions_chatgpt_request_headers: { Authorization: 'Bearer token' },
      }),
    ).toBe(true)
  })

  it('resolves the matching provider credentials and Ollama zero-config base URL', () => {
    const config = resolveAIModelConfig('ollama:llama3.2:latest', {
      extensions_ollama_apibase: '',
      extensions_ollama_request_headers: { Authorization: ' Bearer local ' },
    })

    expect(config).toEqual({
      key: 'ollama:llama3.2:latest',
      providerId: 'ollama',
      modelId: 'llama3.2:latest',
      apiBase: 'http://127.0.0.1:11434/api',
      apiKey: '',
      headers: { Authorization: 'Bearer local' },
    })
  })

  it('accepts both an Ollama host and an /api URL', () => {
    expect(normalizeOllamaApiBaseUrl('http://localhost:11434')).toBe('http://localhost:11434/api')
    expect(normalizeOllamaApiBaseUrl('http://localhost:11434/api/')).toBe(
      'http://localhost:11434/api',
    )
  })
})
