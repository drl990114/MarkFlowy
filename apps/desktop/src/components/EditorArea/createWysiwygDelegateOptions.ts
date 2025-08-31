import { AIGenerateTextParams, getCurrentAISettingData } from '@/extensions/ai/aiProvidersService'
import { aiGenerateTextRequest } from '@/extensions/ai/api'
import useAiChatStore from '@/extensions/ai/useAiChatStore'
import { sleep } from '@/helper'
import { useEditorStore } from '@/stores'
import { convertFileSrc } from '@tauri-apps/api/core'
import { join } from '@tauri-apps/api/path'
import { fetch } from '@tauri-apps/plugin-http'
import type { CreateWysiwygDelegateOptions } from 'rme'

type AIOptions = NonNullable<CreateWysiwygDelegateOptions['ai']>

export const createWysiwygDelegateOptions = (filePath?: string): CreateWysiwygDelegateOptions => {
  const aiStoreState = useAiChatStore.getState()
  const aiProviderModelsMap = aiStoreState.aiProviderModelsMap
  let supportProviderInfosMap: AIOptions['supportProviderInfosMap'] = {}

  Object.entries(aiProviderModelsMap).map(([provider, models]) => {
    supportProviderInfosMap[provider] = {
      models: models,
    }
  })

  return {
    handleViewImgSrcUrl: async (url) => {
      // Ensure asynchronous, returning directly will cause an infinite loop. about:https://github.com/drl990114/MarkFlowy/issues/340
      await sleep(1)

      if (!url) return url

      if ((url.startsWith('http') || url.startsWith('https')) && !url.includes(location.origin)) {
        try {
          const response = await fetch(url, {
            method: 'GET',
          })

          const blob = await response.blob()
          const objectURL = URL.createObjectURL(blob)

          return objectURL
        } catch (error) {
          return url
        }
      }

      if (url.startsWith('data:')) {
        return url
      }

      const dirPath = filePath || useEditorStore.getState().folderData?.[0]?.path
      if (dirPath) {
        const newUrl = await join(dirPath, url)
        return convertFileSrc(newUrl)
      }

      return convertFileSrc(url)
    },
    ai: {
      defaultSelectProvider: aiStoreState.aiProvider,
      supportProviderInfosMap,
      generateText: async (params) => {
        const aiSettingData = getCurrentAISettingData()
        const apiBase = aiSettingData.apiBase
        const apiKey = aiSettingData.apiKey
        const text = await aiGenerateTextRequest({
          sdkProvider: params.provider as AIGenerateTextParams['sdkProvider'],
          url: apiBase,
          apiKey,
          model: params.model,
          text: params.prompt,
        })

        return text
      },
    },
  }
}
