import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeMocks = vi.hoisted(() => {
  const streamText = vi.fn((options) => options)
  const openaiProvider = vi.fn((model) => ({ provider: 'openai', model }))
  const googleProvider = vi.fn((model) => ({ provider: 'google', model }))

  return {
    streamText,
    openaiProvider,
    googleProvider,
  }
})

vi.mock('ai', () => ({
  generateText: vi.fn(async () => ({ text: '' })),
  streamText: runtimeMocks.streamText,
}))

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => runtimeMocks.openaiProvider),
}))

vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: vi.fn(() => runtimeMocks.googleProvider),
}))

vi.mock('@ai-sdk/deepseek', () => ({
  createDeepSeek: vi.fn(() => vi.fn()),
}))

vi.mock('ollama-ai-provider-v2', () => ({
  createOllama: vi.fn(() => vi.fn()),
}))

import { generateTextHandlerMap } from './aiProvidersRuntime'

describe('AI provider runtime streaming', () => {
  beforeEach(() => {
    runtimeMocks.streamText.mockClear()
    runtimeMocks.openaiProvider.mockClear()
  })

  it('creates the selected model without forwarding internal connection options', async () => {
    await generateTextHandlerMap.openai.streamText({
      sdkProvider: 'openai',
      url: 'https://api.openai.com/v1',
      apiKey: 'key',
      model: 'gpt-test',
      messages: [{ role: 'user', content: 'hello' }],
    })

    expect(runtimeMocks.openaiProvider).toHaveBeenCalledWith('gpt-test')
    expect(runtimeMocks.streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: 'openai', model: 'gpt-test' },
        messages: [{ role: 'user', content: 'hello' }],
      }),
    )
    expect(runtimeMocks.streamText.mock.calls[0][0]).not.toHaveProperty('sdkProvider')
    expect(runtimeMocks.streamText.mock.calls[0][0]).not.toHaveProperty('apiKey')
  })
})
