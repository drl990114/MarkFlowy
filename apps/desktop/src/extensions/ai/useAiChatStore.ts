import { aiGenerateTextRequest } from '@/extensions/ai/api'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { cloneDeep } from 'lodash'
import { nanoid } from 'nanoid'
import { useEffect } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  AIGenerateTextParams,
  AIProviders,
  aiProviders,
  aiProviderSettingKeysMap,
} from './aiProvidersService'

export const defaultAiProviderModelsMap = {
  openai: ['gpt-3.5-turbo', 'gpt-4-32k', 'gpt-4'],
  deepseek: ['deepseek-chat'],
  ollama: ['llama3.3'],
}

export const getCurrentAISettingData = () => {
  const settingData = useAppSettingStore.getState().settingData
  const aiProvider = useAiChatStore.getState().aiProvider
  const aiProviderSettings = aiProviderSettingKeysMap[aiProvider]

  return {
    apiBase: settingData[aiProviderSettings.apibase],
    models: settingData[aiProviderSettings.models],
    apiKey: aiProviderSettings.apikey ? settingData[aiProviderSettings.apikey] : '',
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

const useAiChatStore = create<AIStore>()(
  persist(
    (set, get) => ({
      aiProvider: 'openai' as const,
      aiProviderModels: defaultAiProviderModelsMap['openai'],
      aiProviderCurModel: aiProviders.reduce(
        (prev, cur) => {
          return {
            ...prev,
            [cur]: defaultAiProviderModelsMap[cur][0],
          }
        },
        {} as AIStore['aiProviderCurModel'],
      ),
      aiProviderModelsMap: cloneDeep(defaultAiProviderModelsMap),

      chatList: [],

      setChatStatus: (id, status, errorMessage) => {
        set((state) => {
          const curChat = state.chatList.find((history) => history.id === id)
          if (curChat) {
            curChat.status = status
            if (errorMessage) {
              curChat.errorMessage = errorMessage
            }
            return { ...state }
          }
          return state
        })
      },

      addChat: (question: string, url: string, apiKey: string) => {
        const curStore = get()
        const { aiProviderCurModel, aiProvider } = curStore
        const chat = curStore.addChatQuestion(question)

        aiGenerateTextRequest({
          sdkProvider: aiProvider,
          url,
          apiKey,
          model: aiProviderCurModel[aiProvider],
          text: question,
        })
          .then((text) => {
            curStore.addChatAnswer(chat.id, text)
          })
          .catch((error) => {
            const errorMessage = error?.message || error?.toString() || 'Unknown error occurred'
            curStore.setChatStatus(chat.id, 'error', errorMessage)
          })

        return chat
      },

      getPostSummary: async (text: string, url: string, apiKey: string) => {
        const { aiProvider, aiProviderCurModel } = get()
        const res = await aiGenerateTextRequest({
          sdkProvider: aiProvider,
          url,
          apiKey,
          model: aiProviderCurModel[aiProvider],
          text,
          config: {
            messages: [
              {
                role: 'system',
                content:
                  'Please summarize the summary of this article and return it in markdown format. Only the answer can be returned.',
              },
              { role: 'user', content: text },
            ],
          },
        })

        return res
      },

      getPostTranslate: async (text: string, url: string, apiKey: string, targetLang: string) => {
        const { aiProvider, aiProviderCurModel } = get()
        const res = await aiGenerateTextRequest({
          sdkProvider: aiProvider,
          url,
          apiKey,
          model: aiProviderCurModel[aiProvider],
          text: text,
          config: {
            messages: [
              {
                role: 'system',
                content: `Please translate this document completely into ${targetLang} and return it in markdown format. Only the answer can be returned.`,
              },
              { role: 'user', content: text },
            ],
          },
        })

        return res
      },

      addChatQuestion: (question: string) => {
        const chat = {
          id: nanoid(),
          question,
          status: 'pending' as const,
        }
        set((state) => {
          return { ...state, chatList: [...state.chatList, chat] }
        })
        return chat
      },

      addChatAnswer: (id: string, answer: string) => {
        set((state) => {
          const curChat = state.chatList.find((history) => history.id === id)
          if (curChat) {
            curChat.answer = answer
            curChat.status = 'done'
            return { ...state }
          }
          return state
        })
      },

      delChat: (id: string) => {
        set((state) => {
          return {
            ...state,
            chatList: state.chatList.filter((history) => history.id !== id),
          }
        })
      },

      setAiProvider: (provider) => {
        const { aiProviderModelsMap } = get()

        set((prev) => {
          return {
            ...prev,
            aiProvider: provider,
            aiProviderModels: aiProviderModelsMap[provider],
            aiProviderCurModel: {
              ...prev.aiProviderCurModel,
              [provider]: aiProviderModelsMap[provider][0],
            },
          }
        })
      },

      setAiProviderCurModel: (model) => {
        const { aiProvider } = get()

        set((prev) => {
          return {
            ...prev,
            aiProviderCurModel: {
              ...prev.aiProviderCurModel,
              [aiProvider]: model,
            },
          }
        })
      },

      setAiProviderModelsMap: (data) => {
        set((prev) => {
          const aiProviderCurModel = { ...prev.aiProviderCurModel }

          for (const provider in data) {
            aiProviderCurModel[provider as AIProviders] = data[provider as AIProviders][0]
          }

          return {
            ...prev,
            aiProviderModels: data[prev.aiProvider],
            aiProviderModelsMap: data,
            aiProviderCurModel: aiProviderCurModel,
          }
        })
      },
    }),
    {
      name: 'ai-storage',
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    },
  ),
)

type ChatStatus = 'pending' | 'done' | 'error'

export interface AIChatHistory {
  id: string
  question: string
  answer?: string
  status: ChatStatus
  errorMessage?: string
}

interface AIStore {
  aiProvider: AIProviders
  aiProviderModels: string[]
  aiProviderModelsMap: Record<AIProviders, string[]>
  aiProviderCurModel: Record<AIProviders, string>
  chatList: AIChatHistory[]
  setChatStatus: (id: string, status: ChatStatus, errorMessage?: string) => void
  addChat: (question: string, url: string, apiKey: string) => AIChatHistory
  getPostSummary: (text: string, url: string, apiKey: string) => Promise<string>
  getPostTranslate: (
    text: string,
    url: string,
    apiKey: string,
    targetLang: string,
  ) => Promise<string>
  addChatQuestion: (question: string) => AIChatHistory
  addChatAnswer: (id: string, answer: string) => void
  delChat: (id: string) => void
  setAiProvider: (provider: AIGenerateTextParams['sdkProvider']) => void
  setAiProviderCurModel: (model: string) => void
  setAiProviderModelsMap: (aiProviderModelsMap: AIStore['aiProviderModelsMap']) => void
}

export default useAiChatStore
