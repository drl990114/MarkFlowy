import { filterObjectEmptyValues } from '@/helper'
import {
  aiProviderRegistry,
  resolveAIModelConfig,
  type AIGenerateTextParams,
  type AIModelKey,
  type AIStreamTextParams,
} from './aiProvidersService'

export async function aiGenerateTextRequest(params: AIGenerateTextParams) {
  const runtime = await aiProviderRegistry[params.sdkProvider].runtimeFactory()
  return runtime.generateText(params)
}

export type GenerateAITextParams = Omit<
  AIGenerateTextParams,
  'sdkProvider' | 'url' | 'apiKey' | 'model' | 'headers'
> & {
  modelKey: AIModelKey
  settings: Record<string, unknown>
}

/** Preferred model-key API for Ask, summary, translation and editor tools. */
export async function generateAIText(params: GenerateAITextParams) {
  const { modelKey, settings, ...request } = params
  const config = resolveAIModelConfig(modelKey, settings)
  return aiGenerateTextRequest({
    ...request,
    sdkProvider: config.providerId,
    url: config.apiBase,
    apiKey: config.apiKey,
    model: config.modelId,
    headers: config.headers,
  })
}

const DEFAULT_REQUEST_HEADERS: Record<string, string> = {}

function mergeHeaders(
  defaultHeaders: Record<string, string>,
  userHeaders?: Record<string, string>,
): Record<string, string> {
  if (!userHeaders) {
    return { ...defaultHeaders }
  }
  return { ...defaultHeaders, ...userHeaders }
}

export async function aiStreamTextRequest(params: AIStreamTextParams) {
  const noEmptyParams = filterObjectEmptyValues(params) as AIStreamTextParams

  const mergedHeaders = mergeHeaders(DEFAULT_REQUEST_HEADERS, params.headers)
  const paramsWithHeaders = { ...noEmptyParams, headers: mergedHeaders }

  const runtime = await aiProviderRegistry[params.sdkProvider].runtimeFactory()
  return runtime.streamText(paramsWithHeaders)
}

export type StreamAITextParams = Omit<
  AIStreamTextParams,
  'sdkProvider' | 'url' | 'apiKey' | 'model' | 'headers'
> & {
  modelKey: AIModelKey
  settings: Record<string, unknown>
}

/** Preferred model-key API for streaming Ask requests. */
export async function streamAIText(params: StreamAITextParams) {
  const { modelKey, settings, ...request } = params
  const config = resolveAIModelConfig(modelKey, settings)
  return aiStreamTextRequest({
    ...request,
    sdkProvider: config.providerId,
    url: config.apiBase,
    apiKey: config.apiKey,
    model: config.modelId,
    headers: config.headers,
  })
}

export type Status =
  | { status: 'pending'; lastToken: string }
  | { status: 'done'; result: string }
  | { status: 'error'; message: string }
