import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, LanguageModel, ModelMessage } from 'ai'
import { createOllama } from 'ollama-ai-provider-v2'

export type AIGenerateTextParams = {
  sdkProvider: keyof typeof generateTextHandlerMap
  url: string
  apiKey: string
  model: string
  messages: Array<ModelMessage>
  headers?: Record<string, string>
}

export type AIProviders = AIGenerateTextParams['sdkProvider']

type WrapCommonParamsFuncParams = Partial<AIGenerateTextParams> & {
  aiModel: LanguageModel
}

const wrapCommonParams = (params: WrapCommonParamsFuncParams) => {
  const res: Parameters<typeof generateText>[0] = {
    model: params.aiModel,
    messages: params.messages!,
  }

  return res
}

export const generateTextHandlerMap = {
  deepseek: {
    generateText: async (params: AIGenerateTextParams) => {
      const deepseek = createDeepSeek({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      const { text } = await generateText(
        wrapCommonParams({
          aiModel: deepseek(params.model),
          ...params,
        }),
      )

      return text
    },
  },
  openai: {
    generateText: async (params: AIGenerateTextParams) => {
      const openai = createOpenAI({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      const { text } = await generateText(
        wrapCommonParams({
          aiModel: openai(params.model),
          ...params,
        }),
      )

      return text
    },
  },
  ollama: {
    generateText: async (params: AIGenerateTextParams) => {
      const ollama = createOllama({
        baseURL: params.url || undefined,
        headers: params.headers,
      })

      const { text } = await generateText(
        wrapCommonParams({
          aiModel: ollama(params.model),
          ...params,
        }),
      )

      return text
    },
  },
  google: {
    generateText: async (params: AIGenerateTextParams) => {
      const google = createGoogleGenerativeAI({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      const { text } = await generateText(
        wrapCommonParams({
          aiModel: google(params.model),
          ...params,
        }),
      )

      return text
    },
  },
}

export const aiProviders = Object.keys(
  generateTextHandlerMap,
) as (keyof typeof generateTextHandlerMap)[]

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
