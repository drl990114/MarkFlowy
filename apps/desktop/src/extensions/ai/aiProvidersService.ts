import type { ModelMessage, streamText } from 'ai'

export const aiProviders = ['deepseek', 'openai', 'ollama', 'google'] as const

export type AIProviders = (typeof aiProviders)[number]

export type AIGenerateTextParams = {
  sdkProvider: AIProviders
  url: string
  apiKey: string
  model: string
  messages: Array<ModelMessage>
  headers?: Record<string, string>
  abortSignal?: AbortSignal
}

export type AIStreamTextParams = Parameters<typeof streamText>[0] & {
  sdkProvider: AIProviders
  url: string
  apiKey: string
  model: string
  messages: Array<ModelMessage>
  headers?: Record<string, string>
  abortSignal?: AbortSignal
}

export const aiProviderSettingKeysMap: Record<
  AIProviders,
  {
    apibase: string
    models: string
    apikey?: string
    requestHeaders?: string
  }
> = {
  openai: {
    apibase: 'extensions_chatgpt_apibase',
    models: 'extensions_chatgpt_models',
    apikey: 'extensions_chatgpt_apikey',
    requestHeaders: 'extensions_chatgpt_request_headers',
  },
  deepseek: {
    apibase: 'extensions_deepseek_apibase',
    models: 'extensions_deepseek_models',
    apikey: 'extensions_deepseek_apikey',
    requestHeaders: 'extensions_deepseek_request_headers',
  },
  ollama: {
    apibase: 'extensions_ollama_apibase',
    models: 'extensions_ollama_models',
    requestHeaders: 'extensions_ollama_request_headers',
  },
  google: {
    apibase: 'extensions_google_apibase',
    models: 'extensions_google_models',
    apikey: 'extensions_google_apikey',
    requestHeaders: 'extensions_google_request_headers',
  },
}
