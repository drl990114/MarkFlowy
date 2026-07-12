import type { ExportedMessageRepository, ThreadMessageLike } from '@assistant-ui/react'
import { ExportedMessageRepository as MessageRepository } from '@assistant-ui/react'
import { describe, expect, it, vi } from 'vitest'
import {
  LEGACY_AI_STORAGE_KEY,
  TauriAskThreadHistoryAdapter,
  exportAskHistoryMarkdown,
  getAskWorkspaceKey,
  migrateLegacyAskStorage,
  parseLegacyAskStorage,
  pruneAskHistory,
  type AskHistoryStore,
} from './askHistory'

class MemoryStore implements AskHistoryStore {
  data = new Map<string, unknown>()
  async get<T>(key: string) { return this.data.get(key) as T | undefined }
  async set(key: string, value: unknown) { this.data.set(key, structuredClone(value)) }
  async save() {}
}

const makeRepository = (count: number) => {
  const messages: ThreadMessageLike[] = Array.from({ length: count }, (_, index) => ({
    id: `m-${index}`,
    role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
    content: `message ${index}`,
    createdAt: new Date(index),
  }))
  return MessageRepository.fromArray(messages)
}

describe('Ask thread history', () => {
  it('normalizes workspace paths and keeps no-workspace separate', () => {
    expect(getAskWorkspaceKey('/workspace/')).toBe('/workspace')
    expect(getAskWorkspaceKey('C:\\Workspace\\')).toBe('c:/workspace')
    expect(getAskWorkspaceKey()).toContain('temporary')
  })

  it('isolates workspaces and restores dates through Tauri storage', async () => {
    const store = new MemoryStore()
    const a = new TauriAskThreadHistoryAdapter('/a', store)
    const b = new TauriAskThreadHistoryAdapter('/b', store)
    const item = makeRepository(1).messages[0]
    await a.append(item)

    expect((await a.load()).messages[0].message.createdAt).toBeInstanceOf(Date)
    expect((await b.load()).messages).toEqual([])
    await a.clear()
    expect((await a.load()).messages).toEqual([])
  })

  it('does not let a cancelled pre-clear run repopulate a new conversation', async () => {
    const store = new MemoryStore()
    const history = new TauriAskThreadHistoryAdapter('/workspace', store)
    const oldItem = makeRepository(1).messages[0]
    await history.clear()
    await history.append(oldItem)
    expect((await history.load()).messages).toEqual([])
  })

  it('persists branch selection even when no new message is appended', async () => {
    const store = new MemoryStore()
    const history = new TauriAskThreadHistoryAdapter('/workspace', store)
    const repository = MessageRepository.fromBranchableArray(
      [
        { parentId: null, message: { id: 'u', role: 'user', content: 'question' } },
        { parentId: 'u', message: { id: 'a1', role: 'assistant', content: 'first' } },
        { parentId: 'u', message: { id: 'a2', role: 'assistant', content: 'second' } },
      ],
      { headId: 'a2' },
    )
    for (const item of repository.messages) await history.append(item)
    await history.setHead('a1')
    expect((await history.load()).headId).toBe('a1')
  })

  it('drops malformed persisted messages without failing the whole workspace', async () => {
    const store = new MemoryStore()
    store.data.set('workspace:%2Fworkspace', {
      headId: 'bad',
      messages: [
        { parentId: null, message: { id: 'bad', role: 'user', content: [null] } },
      ],
    })
    const history = new TauriAskThreadHistoryAdapter('/workspace', store)
    await expect(history.load()).resolves.toEqual({ messages: [] })
  })

  it('prunes oldest complete turns and keeps every parent link valid', () => {
    const pruned = pruneAskHistory(makeRepository(12), 6, Number.MAX_SAFE_INTEGER)
    const ids = new Set(pruned.messages.map(({ message }) => message.id))
    expect(pruned.messages).toHaveLength(6)
    expect(pruned.messages.every(({ parentId }) => parentId === null || ids.has(parentId))).toBe(true)
    expect(pruned.messages[0].message.id).toBe('m-6')
  })

  it('migrates active responses as interrupted and removes legacy only after writes', async () => {
    const legacy = JSON.stringify({
      state: {
        aiProvider: 'ollama',
        aiProviderCurModel: { ollama: 'llama3.2:latest' },
        chatList: [
          { key: 'u', role: 'user', content: 'question', status: 'done', timestamp: 1 },
          { key: 'a', role: 'ai', content: 'partial', status: 'streaming', timestamp: 2 },
          { key: 'empty', role: 'ai', content: '', status: 'pending', timestamp: 3 },
        ],
      },
    })
    const parsed = parseLegacyAskStorage(legacy)
    expect(parsed?.repository.messages).toHaveLength(2)
    expect(parsed?.repository.messages[1].message).toMatchObject({
      status: { type: 'incomplete', reason: 'cancelled' },
    })

    const removeItem = vi.fn()
    const setModelPreference = vi.fn()
    const migrated = await migrateLegacyAskStorage({
      workspaceKey: '/workspace',
      setModelPreference,
      storage: { getItem: () => legacy, removeItem },
      store: new MemoryStore(),
    })
    expect(migrated).toBe(true)
    expect(setModelPreference).toHaveBeenCalledWith('ollama', 'llama3.2:latest')
    expect(removeItem).toHaveBeenCalledWith(LEGACY_AI_STORAGE_KEY)
  })

  it('retries an interrupted atomic migration without duplicating messages', async () => {
    const legacy = JSON.stringify({
      state: {
        chatList: [
          { role: 'user', content: 'question', timestamp: 1 },
          { role: 'ai', content: 'answer', status: 'done', timestamp: 2 },
        ],
      },
    })
    const store = new MemoryStore()
    let shouldFail = true
    store.save = vi.fn(async () => {
      if (shouldFail) {
        shouldFail = false
        throw new Error('disk full')
      }
    })
    const removeItem = vi.fn()
    const options = {
      workspaceKey: '/workspace',
      setModelPreference: vi.fn(),
      storage: { getItem: () => legacy, removeItem },
      store,
    }

    await expect(migrateLegacyAskStorage(options)).rejects.toThrow('disk full')
    expect(removeItem).not.toHaveBeenCalled()
    await expect(migrateLegacyAskStorage(options)).resolves.toBe(true)

    const migrated = await new TauriAskThreadHistoryAdapter('/workspace', store).load()
    expect(migrated.messages.map(({ message }) => message.id)).toEqual(['legacy-0', 'legacy-1'])
    expect(removeItem).toHaveBeenCalledOnce()
  })

  it('exports only visible text, attachment names and sources', () => {
    const repository = MessageRepository.fromArray([
      {
        id: 'u',
        role: 'user',
        content: 'question',
        attachments: [{
          id: 'ctx', type: 'document', name: 'secret.md', status: { type: 'complete' },
          content: [{ type: 'text', text: 'hidden file body' }],
        }],
      },
      {
        id: 'a', role: 'assistant', content: [
          { type: 'text', text: 'answer' },
          { type: 'source', sourceType: 'url', id: 's', url: 'https://example.com', title: 'Source' },
        ],
      },
    ]) as ExportedMessageRepository
    const markdown = exportAskHistoryMarkdown(repository)
    expect(markdown).toContain('secret.md')
    expect(markdown).toContain('[Source](https://example.com)')
    expect(markdown).not.toContain('hidden file body')
  })
})
