import useAppSettingStore from '@/stores/useAppSettingStore'
import type { ModelMessage } from 'ai'
import { generateAIText } from './api'
import { buildAIModelCatalog, findAIModel, getFirstReadyAIModel } from './aiModelCatalog'
import { getPreferredAIModelKey, setPreferredAIModelKey } from './aiModelPreference'
import { aiProviderRegistry, parseAIModelKey, type AIModelKey } from './aiProvidersService'

function getTextActionModelKey(): AIModelKey {
  const preferred = getPreferredAIModelKey()
  const settings = useAppSettingStore.getState().settingData
  const catalog = buildAIModelCatalog(settings)
  const parsedPreferred = parseAIModelKey(preferred)
  if (
    preferred &&
    (parsedPreferred?.providerId === 'ollama' || findAIModel(catalog, preferred)?.status === 'ready')
  ) {
    return preferred
  }

  const fallback = getFirstReadyAIModel(catalog)
  if (!fallback) throw new Error('No AI provider is configured')
  setPreferredAIModelKey(fallback.key)
  return fallback.key
}

async function runTextAction(messages: ModelMessage[]) {
  return generateAIText({
    modelKey: getTextActionModelKey(),
    settings: useAppSettingStore.getState().settingData,
    messages,
  })
}

export function summarizeAIText(text: string) {
  return runTextAction([
    {
      role: 'system',
      content:
        'Summarize the article in Markdown. Return only the summary, with its key points preserved.',
    },
    { role: 'user', content: text },
  ])
}

export function translateAIText(text: string, targetLanguage: string) {
  return runTextAction([
    {
      role: 'system',
      content: `Translate the document completely into ${targetLanguage}. Return only the translation in Markdown.`,
    },
    { role: 'user', content: text },
  ])
}

export function getCurrentAIProviderDisplayName(): string {
  const parsed = parseAIModelKey(getPreferredAIModelKey())
  if (parsed) return aiProviderRegistry[parsed.providerId].displayName

  try {
    const parsedFallback = parseAIModelKey(getTextActionModelKey())
    return parsedFallback ? aiProviderRegistry[parsedFallback.providerId].displayName : 'AI'
  } catch {
    return 'AI'
  }
}
