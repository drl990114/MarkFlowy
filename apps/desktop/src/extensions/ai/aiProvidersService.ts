import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { createDeepSeek } from '@ai-sdk/deepseek'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useAiChatStore from './useAiChatStore'
import { useEffect } from 'react'

export type AIGenerateTextParams = {
  sdkProvider: keyof typeof generateTextHandlerMap
  url: string
  apiKey: string
  model: string
  text: string
  config?: Pick<Parameters<typeof generateText>[0], 'messages'>
}

export type AIProviders = AIGenerateTextParams['sdkProvider']

export const generateTextHandlerMap = {
  deepseek: {
    generateText: async (params: AIGenerateTextParams) => {
      console.log('params', params)
      const deepseek = createDeepSeek({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
      })

      const { text } = await generateText({
        model: deepseek(params.model),
        prompt: params.text,
      })

      return text
    },
  },
  openai: {
    generateText: async (params: AIGenerateTextParams) => {
      console.log('params', params)
      const openai = createOpenAI({
        baseURL: params.url || undefined,
        apiKey: params.apiKey,
      })

      const { text } = await generateText({
        model: openai(params.model),
        prompt: params.text,
      })

      return text
    },
  },
}

export const aiProviders = Object.keys(
  generateTextHandlerMap,
) as (keyof typeof generateTextHandlerMap)[]

export const defaultAiProviderModelsMap = {
  openai: ['gpt-3.5-turbo', 'gpt-4-32k', 'gpt-4'],
  deepseek: ['deepseek-chat'],
}

export const aiProviderSettingKeysMap = {
  openai: {
    apibase: 'extensions_chatgpt_apibase',
    models: 'extensions_chatgpt_models',
    apikey: 'extensions_chatgpt_apikey',
  },
  deepseek: {
    apibase: 'extensions_deepseek_apibase',
    models: 'extensions_deepseek_models',
    apikey: 'extensions_deepseek_apikey',
  },
}

export const getCurrentAISettingData = () => {
  const settingData = useAppSettingStore.getState().settingData
  const aiProvider = useAiChatStore.getState().aiProvider
  const aiProviderSettings = aiProviderSettingKeysMap[aiProvider]

  return {
    apiBase: settingData[aiProviderSettings.apibase],
    models: settingData[aiProviderSettings.models],
    apiKey: settingData[aiProviderSettings.apikey],
  }
}

export const useRefreshAIProvidersModels = () => {
  const { settingData } = useAppSettingStore()
  const { setAiProviderModelsMap } = useAiChatStore()

  useEffect(() => {
    const res = {} as Record<AIProviders, string[]>
  
    aiProviders.forEach((provider) => {
      const models = settingData[aiProviderSettingKeysMap[provider].models]
        .split(',')
        .map((model: string) => model.trim())
      res[provider] = models
    })
  
    setAiProviderModelsMap(res)


  }, [settingData])
}
