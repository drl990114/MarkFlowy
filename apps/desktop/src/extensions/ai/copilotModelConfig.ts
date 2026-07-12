import { createAIModelKey, normalizeAIProviderId, resolveAIModelConfig } from './aiProvidersService'
import type { AIResolvedModelConfig } from './aiProvidersService'

export function resolveSelectedAIModelConfig(
  provider: unknown,
  model: unknown,
  settings: Record<string, unknown>,
): AIResolvedModelConfig {
  const providerId = normalizeAIProviderId(provider)
  const modelId = typeof model === 'string' ? model.trim() : ''

  if (!providerId || !modelId) {
    throw new Error('AI provider and model must be configured')
  }

  return resolveAIModelConfig(createAIModelKey(providerId, modelId), settings)
}

/**
 * Copilot deliberately resolves its own provider/model pair. It must never
 * borrow the Ask model's provider or credentials.
 */
export function resolveCopilotModelConfig(
  settings: Record<string, unknown>,
): AIResolvedModelConfig {
  return resolveSelectedAIModelConfig(settings.copilot_provider, settings.copilot_model, settings)
}
