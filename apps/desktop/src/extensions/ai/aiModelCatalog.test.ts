import { describe, expect, it } from 'vitest'
import {
  buildAIModelCatalog,
  getFirstReadyAIModel,
  resolvePreferredAIModel,
} from './aiModelCatalog'

describe('AI model catalog', () => {
  const settings = {
    extensions_chatgpt_models: 'shared,openai-only,shared',
    extensions_chatgpt_apikey: 'openai-key',
    extensions_deepseek_models: 'shared',
    extensions_deepseek_apibase: 'https://deepseek.example/v1',
    extensions_google_models: 'gemini',
    extensions_google_apikey: '',
  }

  it('uses provider-qualified keys and hides unconfigured providers', () => {
    const catalog = buildAIModelCatalog(settings, {
      ollamaStatus: 'success',
      ollamaModels: [{ modelId: 'shared', capability: 'completion' }],
    })

    expect(catalog.models.map((model) => model.key)).toEqual([
      'openai:shared',
      'openai:openai-only',
      'deepseek:shared',
      'ollama:shared',
    ])
    expect(catalog.modelsByProvider.google).toEqual([])
    expect(catalog.configuredProviderIds).toEqual(['openai', 'deepseek', 'ollama'])
  })

  it('uses OpenAI, DeepSeek, Google, Ollama as deterministic fallback order', () => {
    const catalog = buildAIModelCatalog(settings, {
      ollamaStatus: 'success',
      ollamaModels: [{ modelId: 'llama', capability: 'completion' }],
    })
    expect(getFirstReadyAIModel(catalog)?.key).toBe('openai:shared')
    expect(resolvePreferredAIModel(catalog, undefined, 'success')).toBe('openai:shared')
  })

  it('keeps an offline selected Ollama model unavailable without cloud fallback', () => {
    const catalog = buildAIModelCatalog(settings, {
      ollamaStatus: 'error',
      selectedModelKey: 'ollama:llama3.2:latest',
    })

    expect(catalog.modelsByProvider.ollama).toEqual([
      expect.objectContaining({
        key: 'ollama:llama3.2:latest',
        status: 'unavailable',
      }),
    ])
    expect(resolvePreferredAIModel(catalog, 'ollama:llama3.2:latest', 'error')).toBe(
      'ollama:llama3.2:latest',
    )
  })

  it('falls back only after successful discovery proves an Ollama model was removed', () => {
    const catalog = buildAIModelCatalog(settings, {
      ollamaStatus: 'success',
      ollamaModels: [{ modelId: 'another-model', capability: 'completion' }],
      selectedModelKey: 'ollama:removed-model',
    })

    expect(resolvePreferredAIModel(catalog, 'ollama:removed-model', 'success')).toBe(
      'openai:shared',
    )
  })
})
