import { aiGenerateTextRequest, aiStreamTextRequest } from '@/extensions/ai/api'
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
  google: ['gemini-2.5-flash'],
}

export type AISettingData = {
  apiBase: string
  models: string
  apiKey: string
  headers?: Record<string, string>
}

export const getCurrentAISettingData = (): AISettingData => {
  const settingData = useAppSettingStore.getState().settingData
  const aiProvider = useAiChatStoreV2.getState().aiProvider
  const aiProviderSettings = aiProviderSettingKeysMap[aiProvider]

  return {
    apiBase: settingData[aiProviderSettings.apibase],
    models: settingData[aiProviderSettings.models],
    apiKey: aiProviderSettings.apikey ? settingData[aiProviderSettings.apikey] : '',
    headers: aiProviderSettings.requestHeaders
      ? settingData[aiProviderSettings.requestHeaders]
      : undefined,
  }
}

export const useRefreshAIProvidersModels = () => {
  const { settingData } = useAppSettingStore()
  const { setAiProviderModelsMap } = useAiChatStoreV2()

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

export interface AIChatMessage {
  key: string
  role: 'user' | 'ai'
  content: string
  status: 'pending' | 'streaming' | 'done' | 'error'
  errorMessage?: string
  timestamp: number
  abortController?: AbortController
}

const useAiChatStoreV2 = create<AIStore>()(
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

      setChatStatus: (key, status, errorMessage) => {
        set((state) => {
          const curChat = state.chatList.find((message) => message.key === key)
          if (curChat) {
            curChat.status = status
            if (errorMessage) {
              curChat.errorMessage = errorMessage
            }
            return { ...state, chatList: [...state.chatList] }
          }
          return state
        })
      },

      addChat: (question: string, aiSettingData) => {
        const curStore = get()
        const { aiProviderCurModel, aiProvider } = curStore
        const { apiKey, apiBase, headers } = aiSettingData

        const userMessage: AIChatMessage = {
          key: `user-${nanoid()}`,
          role: 'user',
          content: question,
          status: 'done',
          timestamp: Date.now(),
        }

        set((state) => ({
          ...state,
          chatList: [...state.chatList, userMessage],
        }))

        const abortController = new AbortController()

        const aiMessageKey = `ai-${nanoid()}`
        const aiMessage: AIChatMessage = {
          key: aiMessageKey,
          role: 'ai',
          content: '',
          status: 'pending',
          timestamp: Date.now(),
          abortController,
        }

        set((state) => ({
          ...state,
          chatList: [...state.chatList, aiMessage],
        }))

        aiStreamTextRequest({
          sdkProvider: aiProvider,
          url: apiBase,
          apiKey,
          headers,
          model: aiProviderCurModel[aiProvider],
          messages: [{ role: 'user', content: question }],
          abortSignal: abortController.signal,
          onError: ({ error }: any) => {
            const errorMessage = error?.message || String(error) || 'Unknown error occurred'
            const state = get()
            state.setChatStatus(aiMessageKey, 'error', errorMessage)
          },
        })
          .then(async (result) => {
            const state = get()
            const curChat = state.chatList.find((message) => message.key === aiMessageKey)

            if (!curChat || curChat.status !== 'pending') {
              return
            }

            let fullText = ''
            let buffer = ''
            let lastFlush = 0
            const FLUSH_INTERVAL_MS = 80
            const MAX_BUFFER_LEN = 256

            try {
              // 逐个获取流式响应的文本块
              for await (const chunk of result.textStream) {
                // 再次检查状态，确保在流处理过程中没有被取消或出错
                const currentState = get()
                const currentChat = currentState.chatList.find(
                  (message) => message.key === aiMessageKey,
                )
                if (currentChat?.status === 'pending') {
                  state.setChatStatus(aiMessageKey, 'streaming')
                } else if (!currentChat || currentChat.status !== 'streaming') {
                  return
                }

                buffer += chunk
                const now = Date.now()
                const shouldFlush =
                  buffer.length >= MAX_BUFFER_LEN || now - lastFlush >= FLUSH_INTERVAL_MS

                if (shouldFlush) {
                  fullText += buffer
                  buffer = ''
                  lastFlush = now
                  set((state) => ({
                    ...state,
                    chatList: state.chatList.map((message) => {
                      if (message.key === aiMessageKey) {
                        return {
                          ...message,
                          content: fullText,
                        }
                      }
                      return message
                    }),
                  }))
                }
              }

              if (buffer.length > 0) {
                fullText += buffer
                buffer = ''
                set((state) => ({
                  ...state,
                  chatList: state.chatList.map((message) => {
                    if (message.key === aiMessageKey) {
                      return {
                        ...message,
                        content: fullText,
                      }
                    }
                    return message
                  }),
                }))
              }

              const finalState = get()
              const finalChat = finalState.chatList.find((message) => message.key === aiMessageKey)
              if (finalChat && finalChat.status === 'streaming') {
                state.setChatStatus(aiMessageKey, 'done')
              }
            } catch (error: any) {
              const errorMessage = error?.message || String(error) || 'Unknown error occurred'
              state.setChatStatus(aiMessageKey, 'error', errorMessage)
            }
          })
          .catch((error) => {
            const errorMessage = error?.message || String(error) || 'Unknown error occurred'
            curStore.setChatStatus(aiMessageKey, 'error', errorMessage)
          })

        return aiMessage
      },

      getPostSummary: async (text: string, aiSettingData) => {
        const { aiProvider, aiProviderCurModel } = get()
        const { apiKey, apiBase, headers } = aiSettingData

        const res = await aiGenerateTextRequest({
          sdkProvider: aiProvider,
          url: apiBase,
          apiKey,
          headers,
          model: aiProviderCurModel[aiProvider],
          messages: [
            {
              role: 'system',
              content:
                'Please summarize the summary of this article and return it in markdown format. Only the answer can be returned.',
            },
            { role: 'user', content: text },
          ],
        })

        return res
      },

      getPostTranslate: async (text: string, aiSettingData, targetLang: string) => {
        const { aiProvider, aiProviderCurModel } = get()
        const { apiKey, apiBase, headers } = aiSettingData

        const res = await aiGenerateTextRequest({
          sdkProvider: aiProvider,
          url: apiBase,
          apiKey,
          headers,
          model: aiProviderCurModel[aiProvider],
          messages: [
            {
              role: 'system',
              content: `Please translate this document completely into ${targetLang} and return it in markdown format. Only the answer can be returned.`,
            },
            { role: 'user', content: text },
          ],
        })

        return res
      },

      addChatQuestion: (question: string) => {
        const message: AIChatMessage = {
          key: `user-${nanoid()}`,
          role: 'user',
          content: question,
          status: 'done',
          timestamp: Date.now(),
        }

        set((state) => {
          return { ...state, chatList: [...state.chatList, message] }
        })
        return message
      },

      addChatAnswer: (key: string, answer: string) => {
        set((state) => {
          const curMessage = state.chatList.find((message) => message.key === key)
          if (curMessage) {
            curMessage.content = answer
            return { ...state }
          }
          return state
        })
      },

      delChat: (key: string) => {
        set((state) => {
          return {
            ...state,
            chatList: state.chatList.filter((message) => message.key !== key),
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

      cancelChatStream: (key) => {
        set((state) => {
          const curMessage = state.chatList.find((message) => message.key === key)
          if (curMessage && curMessage.abortController) {
            curMessage.abortController.abort()
            curMessage.status = 'done'
            return { ...state }
          }
          return state
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
      name: 'ai-storage-v2',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

interface AIStore {
  aiProvider: AIProviders
  aiProviderModels: string[]
  aiProviderModelsMap: Record<AIProviders, string[]>
  aiProviderCurModel: Record<AIProviders, string>
  chatList: AIChatMessage[]
  setChatStatus: (key: string, status: AIChatMessage['status'], errorMessage?: string) => void
  addChat: (question: string, aiSettingData: AISettingData) => AIChatMessage
  getPostSummary: (text: string, aiSettingData: AISettingData) => Promise<string>
  getPostTranslate: (
    text: string,
    aiSettingData: AISettingData,
    targetLang: string,
  ) => Promise<string>
  addChatQuestion: (question: string) => AIChatMessage
  addChatAnswer: (key: string, answer: string) => void
  delChat: (key: string) => void
  cancelChatStream: (key: string) => void
  setAiProvider: (provider: AIGenerateTextParams['sdkProvider']) => void
  setAiProviderCurModel: (model: string) => void
  setAiProviderModelsMap: (aiProviderModelsMap: AIStore['aiProviderModelsMap']) => void
}

export default useAiChatStoreV2
