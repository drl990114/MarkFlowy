import { filterObjectEmptyValues } from '@/helper'
import { AIGenerateTextParams, AIStreamTextParams, generateTextHandlerMap } from './aiProvidersService'

export async function aiGenerateTextRequest(params: AIGenerateTextParams) {
  const handler = generateTextHandlerMap[params.sdkProvider]?.generateText
  return handler(params)
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

  const handler = generateTextHandlerMap[params.sdkProvider]?.streamText
  return handler(paramsWithHeaders)
}

export type Status =
  | { status: 'pending'; lastToken: string }
  | { status: 'done'; result: string }
  | { status: 'error'; message: string }
