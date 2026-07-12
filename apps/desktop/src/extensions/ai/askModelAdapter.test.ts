import type { ChatModelRunResult, ThreadMessageLike } from '@assistant-ui/react'
import { ExportedMessageRepository } from '@assistant-ui/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/helper/files', () => ({ getFileObject: vi.fn() }))
vi.mock('@/stores/useEditorStore', () => ({
  default: { getState: () => ({ activeId: undefined, opened: [] }) },
}))
vi.mock('@/stores/useAppSettingStore', () => ({
  default: { getState: () => ({ settingData: {} }) },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('./api', () => ({ streamAIText: vi.fn() }))
import { buildAskModelMessages, createAskModelAdapter } from './askModelAdapter'

function toMessages(messages: ThreadMessageLike[]) {
  return ExportedMessageRepository.fromArray(messages).messages.map(({ message }) => message)
}

describe('Ask ChatModelAdapter', () => {
  it('sends frozen bodies only for the current request and names for old attachments', () => {
    const messages = toMessages([
      {
        role: 'user',
        content: 'old question',
        attachments: [
          {
            id: 'old',
            type: 'document',
            name: 'old.md',
            status: { type: 'complete' },
            content: [{ type: 'text', text: 'OLD SECRET BODY' }],
          },
        ],
      },
      { role: 'assistant', content: 'old answer' },
      {
        role: 'user',
        content: 'new question',
        attachments: [
          {
            id: 'new',
            type: 'document',
            name: 'new.md',
            status: { type: 'complete' },
            content: [{ type: 'text', text: 'NEW FROZEN BODY' }],
          },
        ],
      },
    ])

    const result = buildAskModelMessages(messages)
    expect(result.map(({ content }) => String(content)).join('\n')).not.toContain('OLD SECRET BODY')
    expect(result.map(({ content }) => String(content)).join('\n')).toContain(
      '[Attached document: old.md]',
    )
    expect(result.at(-1)?.content).toContain('NEW FROZEN BODY')
  })

  it('yields cumulative text at the buffer threshold', async () => {
    const stream = vi.fn(async () => ({
      textStream: (async function* () {
        yield 'a'.repeat(200)
        yield 'b'.repeat(80)
      })(),
    }))
    const adapter = createAskModelAdapter({
      getModelKey: () => 'openai:gpt-test',
      getSettings: () => ({}),
      stream: stream as never,
      now: () => 1,
    })
    const abortController = new AbortController()
    const output: ChatModelRunResult[] = []
    const run = adapter.run({
      messages: toMessages([{ role: 'user', content: 'question' }]),
      runConfig: { custom: { modelKey: 'openai:gpt-test' } },
      abortSignal: abortController.signal,
      context: { tools: {}, system: '', callSettings: {} },
      unstable_getMessage: () => toMessages([{ role: 'assistant', content: '' }])[0],
    }) as AsyncGenerator<ChatModelRunResult>
    for await (const item of run) {
      output.push(item)
    }

    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({
        modelKey: 'openai:gpt-test',
        abortSignal: abortController.signal,
      }),
    )
    expect(output.at(-1)?.content).toEqual([
      { type: 'text', text: `${'a'.repeat(200)}${'b'.repeat(80)}` },
    ])
  })

  it('trims history by complete turns instead of retaining an orphan assistant answer', () => {
    const messages = toMessages([
      { role: 'user', content: 'x'.repeat(13_000) },
      { role: 'assistant', content: 'short old answer' },
      { role: 'user', content: 'current question' },
    ])

    const result = buildAskModelMessages(messages)
    expect(result.map(({ role }) => role)).toEqual(['system', 'user'])
    expect(result.at(-1)?.content).toBe('current question')
  })

  it('throws an AbortError without a final result after cancellation', async () => {
    const abortController = new AbortController()
    const adapter = createAskModelAdapter({
      getModelKey: () => 'openai:gpt-test',
      getSettings: () => ({}),
      stream: (async () => ({
        textStream: (async function* () {
          abortController.abort()
          yield 'ignored'
        })(),
      })) as never,
    })
    const output: ChatModelRunResult[] = []
    const run = adapter.run({
      messages: toMessages([{ role: 'user', content: 'question' }]),
      runConfig: {},
      abortSignal: abortController.signal,
      context: { tools: {}, system: '', callSettings: {} },
      unstable_getMessage: () => toMessages([{ role: 'assistant', content: '' }])[0],
    }) as AsyncGenerator<ChatModelRunResult>
    await expect(async () => {
      for await (const item of run) output.push(item)
    }).rejects.toMatchObject({ name: 'AbortError' })
    expect(output).toEqual([])
  })
})
