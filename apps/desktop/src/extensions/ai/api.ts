import { filterObjectEmptyValues } from '@/helper'
import { AIGenerateTextParams, AIStreamTextParams, generateTextHandlerMap } from './aiProvidersService'

export async function aiGenerateTextRequest(params: AIGenerateTextParams) {
  const handler = generateTextHandlerMap[params.sdkProvider]?.generateText
  return handler(params)
}

export async function aiStreamTextRequest(params: AIStreamTextParams) {
  const noEmptyParams = filterObjectEmptyValues(params) as AIStreamTextParams

  const handler = generateTextHandlerMap[params.sdkProvider]?.streamText
  return handler(noEmptyParams)
}

export type Status =
  | { status: 'pending'; lastToken: string }
  | { status: 'done'; result: string }
  | { status: 'error'; message: string }
