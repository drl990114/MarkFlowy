import { AIGenerateTextParams } from '@/extensions/ai/aiProvidersService'
import { aiGenerateTextRequest } from '@/extensions/ai/api'
import useAiChatStore, { getCurrentAISettingData } from '@/extensions/ai/useAiChatStore'
import { sleep } from '@/helper'
import { clipboardRead } from '@/helper/clipboard'
import { getFileObject } from '@/helper/files'
import { getFolderPathFromPath, getMdRelativePath } from '@/helper/filesys'
import { convertImageToBase64, getImageUrlInTauri, moveImageToLocalFolder } from '@/helper/image'
import { useEditorKeybindingStore } from '@/hooks/useKeyboard'
import { useEditorStore } from '@/stores'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { join } from '@tauri-apps/api/path'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import type { CreateWysiwygDelegateOptions } from 'rme'

type AIOptions = NonNullable<CreateWysiwygDelegateOptions['ai']>

export const createWysiwygDelegateOptions = (fileId?: string): CreateWysiwygDelegateOptions => {
  const aiStoreState = useAiChatStore.getState()
  const aiProviderModelsMap = aiStoreState.aiProviderModelsMap
  let supportProviderInfosMap: AIOptions['supportProviderInfosMap'] = {}

  Object.entries(aiProviderModelsMap).map(([provider, models]) => {
    supportProviderInfosMap[provider] = {
      models: models,
    }
  })
  const settingData = useAppSettingStore.getState().settingData

  return {
    disableAllBuildInShortcuts: true,
    overrideShortcutMap: useEditorKeybindingStore.getState().editorKeybingMap,
    codemirrorOptions: {
      lineWrapping: settingData.wysiwyg_editor_codemirror_line_wrap,
    },
    clipboardReadFunction: clipboardRead,
    imagePasteHandler: async (src) => {
      await sleep(1)

      try {
        const file = fileId ? getFileObject(fileId) : null
        const fileFolderPath = getFolderPathFromPath(file?.path)

        const workspaceRoot = useEditorStore.getState().folderData?.[0]?.path
        const settingData = useAppSettingStore.getState().settingData

        const isTextbundle = fileFolderPath?.endsWith('.textbundle')

        if (isTextbundle) {
          const targetPath = `${fileFolderPath || workspaceRoot || ''}/assets`

          if (workspaceRoot) {
            const fullPath = await moveImageToLocalFolder(src, targetPath)
            return await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot)
          }
        }

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
          const fullPath = await moveImageToLocalFolder(src, targetPath)
          if (workspaceRoot) {
            return await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot)
          } else {
            return fullPath
          }
        }

        if (
          settingData.when_paste_image === 'save_to_local_absolute' &&
          settingData.paste_image_save_absolute_path
        ) {
          const targetPath = settingData.paste_image_save_absolute_path
          const fullPath = await moveImageToLocalFolder(src, targetPath)
          return fullPath
        }

        if (
          settingData.when_paste_image === 'save_to_file_relative' &&
          settingData.paste_image_save_relative_path_rule
        ) {
          const targetPath = settingData.paste_image_save_relative_path_rule.replace(
            '${documentPath}',
            fileFolderPath || '',
          )
          const fullPath = await moveImageToLocalFolder(src, targetPath)

          if (workspaceRoot) {
            return await getMdRelativePath(fullPath, fileFolderPath || workspaceRoot || '')
          } else {
            return fullPath
          }
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
        const file = fileId ? getFileObject(fileId) : null
        const fileFolderPath = getFolderPathFromPath(file?.path)

        const src = await getImageUrlInTauri(url, fileFolderPath)
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
          messages: [
            {
              role: 'system',
              content:
                'You are a helpful Markdown editor assistant, Please refer to the user information to generate the Markdown content.',
            },
            {
              role: 'user',
              content: params.prompt,
            },
          ],
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
