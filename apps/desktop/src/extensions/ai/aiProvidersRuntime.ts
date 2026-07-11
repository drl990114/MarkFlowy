import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { generateText, streamText } from 'ai'
import { createOllama } from 'ollama-ai-provider-v2'
import type { AIGenerateTextParams, AIProviders, AIStreamTextParams } from './aiProvidersService'
import { normalizeOllamaApiBaseUrl } from './aiProvidersService'

const providerFetch = tauriFetch as typeof fetch

function getGenerateTextConfig(params: AIGenerateTextParams) {
  const { sdkProvider, url, apiKey, model, headers, ...request } = params
  return { sdkProvider, url, apiKey, model, headers, request }
}

function getStreamTextConfig(params: AIStreamTextParams) {
  const { sdkProvider, url, apiKey, model, tools, toolChoice, ...request } = params
  return { sdkProvider, url, apiKey, model, tools, toolChoice, request }
}

export const generateTextHandlerMap: Record<
  AIProviders,
  {
    generateText: (params: AIGenerateTextParams) => Promise<string>
    streamText: (params: AIStreamTextParams) => Promise<ReturnType<typeof streamText>>
  }
> = {
  deepseek: {
    generateText: async (params) => {
      const { url, apiKey, model, headers, request } = getGenerateTextConfig(params)
      const deepseek = createDeepSeek({
        baseURL: url || undefined,
        apiKey,
        headers,
        fetch: providerFetch,
      })

      const { text } = await generateText({
        ...request,
        model: deepseek(model),
      })

      return text
    },
    streamText: async (params) => {
      const { url, apiKey, model, tools, toolChoice, request } = getStreamTextConfig(params)
      const deepseek = createDeepSeek({
        baseURL: url || undefined,
        apiKey,
        headers: request.headers,
        fetch: providerFetch,
      })

      return streamText({
        ...request,
        model: deepseek(model),
        tools,
        toolChoice,
      })
    },
  },
  openai: {
    generateText: async (params) => {
      const { url, apiKey, model, headers, request } = getGenerateTextConfig(params)
      const openai = createOpenAI({
        baseURL: url || undefined,
        apiKey,
        headers,
        fetch: providerFetch,
      })

      const { text } = await generateText({
        ...request,
        model: openai(model),
      })

      return text
    },
    streamText: async (params) => {
      const { url, apiKey, model, tools, toolChoice, request } = getStreamTextConfig(params)
      const openai = createOpenAI({
        baseURL: url || undefined,
        apiKey,
        headers: request.headers,
        fetch: providerFetch,
      })

      return streamText({ ...request, model: openai(model), tools, toolChoice })
    },
  },
  ollama: {
    generateText: async (params) => {
      const { url, model, headers, request } = getGenerateTextConfig(params)
      const ollama = createOllama({
        baseURL: normalizeOllamaApiBaseUrl(url),
        headers,
        fetch: providerFetch,
      })

      const { text } = await generateText({
        ...request,
        model: ollama(model),
      })

      return text
    },
    streamText: async (params) => {
      const { url, model, tools, toolChoice, request } = getStreamTextConfig(params)
      const ollama = createOllama({
        baseURL: normalizeOllamaApiBaseUrl(url),
        headers: request.headers,
        fetch: providerFetch,
      })

      return streamText({
        ...request,
        model: ollama(model),
        tools,
        toolChoice,
      })
    },
  },
  google: {
    generateText: async (params) => {
      const { url, apiKey, model, headers, request } = getGenerateTextConfig(params)
      const google = createGoogleGenerativeAI({
        baseURL: url || undefined,
        apiKey,
        headers,
        fetch: providerFetch,
      })

      const { text } = await generateText({
        ...request,
        model: google(model),
      })

      return text
    },
    streamText: async (params) => {
      const { url, apiKey, model, tools, toolChoice, request } = getStreamTextConfig(params)
      const google = createGoogleGenerativeAI({
        baseURL: url || undefined,
        apiKey,
        headers: request.headers,
        fetch: providerFetch,
      })

      return streamText({ ...request, model: google(model), tools, toolChoice })
    },
  },
}
