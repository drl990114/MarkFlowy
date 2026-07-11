import {
  aiProviderRegistry,
  aiProviders,
  createAIModelKey,
  isCloudProviderConfigured,
  parseAIModelKey,
  parseConfiguredModels,
} from './aiProvidersService'
import type { AIModelDescriptor, AIModelKey, AIProviderId } from './aiProvidersService'
import type { OllamaDiscoveredModel, OllamaDiscoveryStatus } from './ollamaDiscovery'

export type AIModelCatalog = {
  models: AIModelDescriptor[]
  modelsByProvider: Record<AIProviderId, AIModelDescriptor[]>
  configuredProviderIds: AIProviderId[]
}

export type BuildAIModelCatalogOptions = {
  ollamaModels?: OllamaDiscoveredModel[]
  ollamaStatus?: OllamaDiscoveryStatus
  selectedModelKey?: AIModelKey
}

function createEmptyModelsByProvider(): Record<AIProviderId, AIModelDescriptor[]> {
  return {
    openai: [],
    deepseek: [],
    google: [],
    ollama: [],
  }
}

/**
 * Builds the selector catalog directly from app settings and query data. It is
 * intentionally pure: unrelated settings changes cannot rewrite preference.
 */
export function buildAIModelCatalog(
  settings: Record<string, unknown>,
  options: BuildAIModelCatalogOptions = {},
): AIModelCatalog {
  const modelsByProvider = createEmptyModelsByProvider()

  for (const providerId of aiProviders) {
    if (providerId === 'ollama') {
      if (options.ollamaStatus === 'success') {
        modelsByProvider.ollama = (options.ollamaModels ?? []).map((model) => ({
          key: createAIModelKey('ollama', model.modelId),
          providerId: 'ollama',
          modelId: model.modelId,
          source: 'discovered',
          status: 'ready',
        }))
      }
      continue
    }

    if (!isCloudProviderConfigured(providerId, settings)) continue

    const registration = aiProviderRegistry[providerId]
    modelsByProvider[providerId] = parseConfiguredModels(
      settings[registration.settingKeys.models],
    ).map((modelId) => ({
      key: createAIModelKey(providerId, modelId),
      providerId,
      modelId,
      source: 'configured',
      status: 'ready',
    }))
  }

  // When Ollama is offline/loading, preserve the selected local model and make
  // its unavailable state explicit instead of silently switching providers.
  const selected = parseAIModelKey(options.selectedModelKey)
  if (
    selected?.providerId === 'ollama' &&
    options.ollamaStatus !== 'success' &&
    !modelsByProvider.ollama.some((model) => model.key === options.selectedModelKey)
  ) {
    modelsByProvider.ollama = [
      {
        key: createAIModelKey('ollama', selected.modelId),
        providerId: 'ollama',
        modelId: selected.modelId,
        source: 'discovered',
        status: 'unavailable',
      },
    ]
  }

  const models = aiProviders.flatMap((providerId) => modelsByProvider[providerId])
  const configuredProviderIds = aiProviders.filter((providerId) =>
    modelsByProvider[providerId].some((model) => model.status === 'ready'),
  )

  return { models, modelsByProvider, configuredProviderIds }
}

export function findAIModel(
  catalog: AIModelCatalog,
  modelKey: AIModelKey | string | undefined,
): AIModelDescriptor | undefined {
  return modelKey ? catalog.models.find((model) => model.key === modelKey) : undefined
}

export function getFirstReadyAIModel(catalog: AIModelCatalog): AIModelDescriptor | undefined {
  // catalog.models already follows the documented fallback order.
  return catalog.models.find((model) => model.status === 'ready')
}

/**
 * Reconciles a stored preference after a meaningful catalog transition. An
 * unavailable Ollama selection is retained unless discovery succeeded and
 * proved the model was deleted.
 */
export function resolvePreferredAIModel(
  catalog: AIModelCatalog,
  preferredKey: AIModelKey | undefined,
  ollamaStatus: OllamaDiscoveryStatus,
): AIModelKey | undefined {
  const preferred = preferredKey ? findAIModel(catalog, preferredKey) : undefined
  if (preferred?.status === 'ready') return preferred.key

  const parsedPreferred = parseAIModelKey(preferredKey)
  if (parsedPreferred?.providerId === 'ollama' && ollamaStatus !== 'success') {
    return preferredKey
  }

  return getFirstReadyAIModel(catalog)?.key
}
