import { AIGenerateTextParams, generateTextHandlerMap } from './aiProvidersService'

export async function aiGenerateTextRequest(params: AIGenerateTextParams) {
  const handler = generateTextHandlerMap[params.sdkProvider]?.generateText
  return handler(params)
}

export type Status =
  | { status: 'pending'; lastToken: string }
  | { status: 'done'; result: string }
  | { status: 'error'; message: string }
