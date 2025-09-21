import { AIGenerateTextParams } from '@/extensions/ai/aiProvidersService'
import { aiGenerateTextRequest } from '@/extensions/ai/api'
import useAiChatStore, { getCurrentAISettingData } from '@/extensions/ai/useAiChatStore'
import { sleep } from '@/helper'
import { convertImageToBase64, getImageUrlInTauri, moveImageToFolder } from '@/helper/image'
import { useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { join } from '@tauri-apps/api/path'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
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
    imageCopyHandler: async (src) => {
      await sleep(1)

      try {
        const workspaceRoot = useEditorStore.getState().folderData?.[0]?.path
        const settingData = useAppSettingStore.getState().settingData

        if (settingData.when_paste_image === 'do_nothing') {
          return src
        }
        if (settingData.when_paste_image === 'paste_as_base64') {
          return await convertImageToBase64(src)
        }
        if (
          settingData.when_paste_image === 'save_to_local_relative' &&
          settingData.paste_image_save_relative_path
        ) {
          const targetPath = await join(
            workspaceRoot || '',
            settingData.paste_image_save_relative_path,
          )
          if (workspaceRoot) {
            return await moveImageToFolder(src, targetPath)
          }
        }

        if (
          settingData.when_paste_image === 'save_to_local_absolute' &&
          settingData.paste_image_save_absolute_path
        ) {
          const targetPath = settingData.paste_image_save_absolute_path
          return await moveImageToFolder(src, targetPath)
        }
      } catch (error) {
        console.error('Image conversion failed:', error)
      }

      console.log('All conversion methods failed, returning original src')
      return src
    },
    handleViewImgSrcUrl: async (url) => {
      await sleep(1)

      try {
        const src = await getImageUrlInTauri(url, filePath)
        return src
      } catch (error) {
        console.error('Failed to get image URL:', error)
      }
      return url
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
    customCopyFunction: async (text) => {
      try {
        await writeText(text)
        return true
      } catch (error) {
        return false
      }
    },
  }
}
