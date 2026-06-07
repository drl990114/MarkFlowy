import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { generateText, streamText } from 'ai'
import { createOllama } from 'ollama-ai-provider-v2'
import type { AIGenerateTextParams, AIProviders } from './aiProvidersService'

export const generateTextHandlerMap: Record<
  AIProviders,
  {
    generateText: (params: AIGenerateTextParams) => Promise<string>
    streamText: (params: AIGenerateTextParams) => Promise<ReturnType<typeof streamText>>
  }
> = {
  deepseek: {
    generateText: async (params) => {
      const deepseek = createDeepSeek({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      const { text } = await generateText({
        ...params,
        model: deepseek(params.model),
      })

      return text
    },
    streamText: async (params) => {
      const deepseek = createDeepSeek({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      return streamText({
        ...params,
        model: deepseek(params.model),
      })
    },
  },
  openai: {
    generateText: async (params) => {
      const openai = createOpenAI({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      const { text } = await generateText({
        ...params,
        model: openai(params.model),
      })

      return text
    },
    streamText: async (params) => {
      const openai = createOpenAI({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      return streamText({
        ...params,
        model: openai(params.model),
      })
    },
  },
  ollama: {
    generateText: async (params) => {
      const ollama = createOllama({
        baseURL: params.url || undefined,
        headers: params.headers,
      })

      const { text } = await generateText({
        ...params,
        model: ollama(params.model),
      })

      return text
    },
    streamText: async (params) => {
      const ollama = createOllama({
        baseURL: params.url || undefined,
        headers: params.headers,
      })

      return streamText({
        ...params,
        model: ollama(params.model),
      })
    },
  },
  google: {
    generateText: async (params) => {
      const google = createGoogleGenerativeAI({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      const { text } = await generateText({
        ...params,
        model: google(params.model),
      })

      return text
    },
    streamText: async (params) => {
      const google = createGoogleGenerativeAI({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
        headers: params.headers,
      })

      return streamText({
        ...params,
        model: google(params.model),
      })
    },
  },
}
