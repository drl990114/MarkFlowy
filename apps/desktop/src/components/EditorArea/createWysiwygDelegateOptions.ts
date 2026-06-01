import { AIGenerateTextParams } from '@/extensions/ai/aiProvidersService'
import { aiGenerateTextRequest } from '@/extensions/ai/api'
import useAiChatStore, { getCurrentAISettingData } from '@/extensions/ai/useAiChatStore'
import { sleep } from '@/helper'
import { clipboardRead } from '@/helper/clipboard'
import { getFileObject } from '@/helper/files'
import { getFolderPathFromPath } from '@/helper/filesys'
import { getImageUrlInTauri } from '@/helper/image'
import { logger } from '@/helper/logger'
import { useEditorKeybindingStore } from '@/hooks/useKeyboard'
import { locales } from '@/i18n'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { CreateWysiwygDelegateOptions } from 'rme'
import { handleUploadImage, handleImagePaste } from './imageHandlers'

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
    typewriterScroll: {
      enabled: settingData.editor_typewriter_scroll,
    },
    placeholder: {
      enabled: settingData.editor_placeholder,
    },
    clipboardReadFunction: clipboardRead,
    uploadImageHandler: (files) => handleUploadImage(files, fileId),
    imagePasteHandler: (src) => handleImagePaste(src, fileId),
    handleViewImgSrcUrl: async (url) => {
      await sleep(1)

      try {
        const decodedUrl = decodeURIComponent(url)
        const file = fileId ? getFileObject(fileId) : null
        const fileFolderPath = getFolderPathFromPath(file?.path)

        const src = await getImageUrlInTauri(decodedUrl, fileFolderPath)
        return src
      } catch (error) {
        logger.error('Failed to get image URL:', error)
      }
      return url
    },
    ai: {
      defaultSelectProvider: aiStoreState.aiProvider,
      supportProviderInfosMap,
      copilot: settingData.copilot_enabled
        ? {
            generateText: async ({
              context,
            }: {
              context: {
                prevParagraph: string | null
                nextParagraph: string | null
                textBefore: string
                textAfter: string
                nodeType: string
              }
            }) => {
              const aiSettingData = getCurrentAISettingData()
              const apiBase = aiSettingData.apiBase
              const apiKey = aiSettingData.apiKey
              const headers = aiSettingData.headers

              const contextPrompt = [
                context.prevParagraph ? `Previous paragraph: ${context.prevParagraph}` : '',
                `Current paragraph context:`,
                `Text before cursor: ${context.textBefore}`,
                `Text after cursor: ${context.textAfter}`,
                context.nextParagraph ? `Next paragraph: ${context.nextParagraph}` : '',
              ]
                .filter(Boolean)
                .join('\n')

              logger.info('copilot', contextPrompt)
              const text = await aiGenerateTextRequest({
                sdkProvider: (settingData.copilot_provider as string)?.toLowerCase() as AIGenerateTextParams['sdkProvider'],
                url: apiBase,
                apiKey,
                model: settingData.copilot_model,
                messages: [
                  {
                    role: 'system',
                    content:
                      '## Task: Content Completion, Fill Text at the `{CURSOR}` Position.\n' +
                      '\n' +
                      '### Instructions:\n' +
                      '- You are a world class writing assistant.\n' +
                      '- Given the current text, context, and the `{CURSOR}` position, provide a suggestion for text completion.\n' +
                      '- The suggestion must be based on the current text, as well as the text before the cursor.\n' +
                      '- Output ONLY the missing continuation immediately after the cursor, not a full rewrite.\n' +
                      '- Never repeat or paraphrase any part of the existing text before or after the cursor.\n' +
                      '- Write in the same language as the user input (auto-detect from the context). If unclear, default to ' +
                      `${locales[settingData.language as keyof typeof locales]}.\n` +
                      '- Continue the writing style and tone of the existing text.\n' +
                      '- Use Markdown only if already present in the paragraph; do not introduce new headings or lists.\n' +
                      '- Complete ONLY the current paragraph. Do not start a new paragraph or add unrelated content.\n' +
                      '- Keep the completion short: at most 2 sentences.\n' +
                      '- THIS IS NOT A CONVERSATION, SO PLEASE DO NOT ASK QUESTIONS OR PROMPT FOR ADDITIONAL INFORMATION.\n' +
                      '\n' +
                      '### Notes:\n' +
                      '- Never include any annotations such as "Suggestion:" or "Suggestions:".\n' +
                      '- Never suggest a newline after a space or newline.\n' +
                      '- If you do not have a suggestion, return an empty string.\n' +
                      '- If text after the cursor is non-empty, return an empty string.\n' +
                      '- DO NOT RETURN ANY TEXT THAT IS ALREADY PRESENT IN THE CURRENT TEXT.\n',
                  },
                  {
                    role: 'system',
                    content: 'Context:\n' + '---\n' + contextPrompt + '\n' + '---\n',
                  },
                ],
                headers,
              })
              return text
            },
          }
        : undefined,
      generateText: async (params) => {
        const aiSettingData = getCurrentAISettingData()
        const apiBase = aiSettingData.apiBase
        const apiKey = aiSettingData.apiKey
        const headers = aiSettingData.headers
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
          headers,
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
    handleLinkClick: (href) => {
      openUrl(href)
      return true
    },
  }
}
