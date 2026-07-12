import { describe, expect, it } from 'vitest'
import { resolveCopilotModelConfig, resolveSelectedAIModelConfig } from './copilotModelConfig'

describe('Copilot model configuration', () => {
  it('maps the legacy ChatGPT label to OpenAI and reads OpenAI credentials', () => {
    const config = resolveCopilotModelConfig({
      copilot_provider: 'ChatGPT',
      copilot_model: 'gpt-4.1-mini',
      extensions_chatgpt_apibase: 'https://openai.example/v1',
      extensions_chatgpt_apikey: 'openai-key',
      extensions_chatgpt_request_headers: { 'X-OpenAI': 'yes' },
      extensions_deepseek_apibase: 'https://ask-provider.example/v1',
      extensions_deepseek_apikey: 'ask-provider-key',
    })

    expect(config).toMatchObject({
      key: 'openai:gpt-4.1-mini',
      providerId: 'openai',
      modelId: 'gpt-4.1-mini',
      apiBase: 'https://openai.example/v1',
      apiKey: 'openai-key',
      headers: { 'X-OpenAI': 'yes' },
    })
  })

  it('normalizes Ollama host addresses for editor requests', () => {
    const config = resolveSelectedAIModelConfig('Ollama', 'llama3.2:latest', {
      extensions_ollama_apibase: 'http://localhost:11434/',
    })

    expect(config).toMatchObject({
      key: 'ollama:llama3.2:latest',
      apiBase: 'http://localhost:11434/api',
      apiKey: '',
    })
  })

  it('rejects an empty Copilot selection', () => {
    expect(() => resolveCopilotModelConfig({ copilot_provider: '', copilot_model: '' })).toThrow(
      'AI provider and model must be configured',
    )
  })
})
