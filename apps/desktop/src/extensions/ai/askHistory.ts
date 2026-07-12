import type {
  ExportedMessageRepository,
  ExportedMessageRepositoryItem,
  ThreadHistoryAdapter,
  ThreadMessage,
  ThreadMessageLike,
} from '@assistant-ui/react'
import { ExportedMessageRepository as MessageRepository } from '@assistant-ui/react'
import { LazyStore } from '@tauri-apps/plugin-store'

export const ASK_HISTORY_STORE_FILE = '.markflowy_ai_ask.dat'
export const ASK_HISTORY_MAX_MESSAGES = 100
export const ASK_HISTORY_MAX_BYTES = 5 * 1024 * 1024
export const LEGACY_AI_STORAGE_KEY = 'ai-storage-v2'

const TEMPORARY_WORKSPACE_KEY = '__temporary_workspace__'

export interface AskHistoryStore {
  get<T>(key: string): Promise<T | undefined>
  set(key: string, value: unknown): Promise<void>
  save(): Promise<void>
}

let sharedStore: LazyStore | undefined

function getSharedStore(): LazyStore {
  sharedStore ??= new LazyStore(ASK_HISTORY_STORE_FILE, { defaults: {}, autoSave: false })
  return sharedStore
}

export function getAskWorkspaceKey(rootPath?: string | null): string {
  if (!rootPath?.trim()) return TEMPORARY_WORKSPACE_KEY

  const normalized = rootPath.trim().replace(/\\/g, '/').replace(/\/+$/, '') || '/'
  return /^[A-Za-z]:\//.test(normalized) ? normalized.toLowerCase() : normalized
}

function getStoreKey(workspaceKey: string): string {
  return `workspace:${encodeURIComponent(workspaceKey)}`
}

export class TauriAskThreadHistoryAdapter implements ThreadHistoryAdapter {
  private operation = Promise.resolve()
  private clearedAt = Number.NEGATIVE_INFINITY

  constructor(
    readonly workspaceKey: string,
    private readonly store: AskHistoryStore = getSharedStore(),
  ) {}

  async load(): Promise<ExportedMessageRepository> {
    await this.operation
    const value = await this.store.get<unknown>(getStoreKey(this.workspaceKey))
    return normalizeStoredRepository(value)
  }

  async append(item: ExportedMessageRepositoryItem): Promise<void> {
    if (item.message.createdAt.getTime() < this.clearedAt) return
    return this.enqueue(async () => {
      if (item.message.createdAt.getTime() < this.clearedAt) return
      const repository = await this.loadDirect()
      const existingIndex = repository.messages.findIndex(
        ({ message }) => message.id === item.message.id,
      )
      if (existingIndex >= 0) repository.messages[existingIndex] = item
      else repository.messages.push(item)
      repository.headId = item.message.id
      await this.write(pruneAskHistory(repository))
    })
  }

  async delete(items: ExportedMessageRepositoryItem[]): Promise<void> {
    if (items.length === 0) return
    return this.enqueue(async () => {
      const repository = await this.loadDirect()
      const next = deleteHistoryMessages(
        repository,
        new Set(items.map(({ message }) => message.id)),
      )
      await this.write(pruneAskHistory(next))
    })
  }

  async clear(): Promise<void> {
    this.clearedAt = Date.now()
    return this.enqueue(() => this.write({ messages: [] }))
  }

  async replace(repository: ExportedMessageRepository): Promise<void> {
    return this.enqueue(() => this.write(pruneAskHistory(repository)))
  }

  async setHead(headId: string | null | undefined): Promise<void> {
    return this.enqueue(async () => {
      const repository = await this.loadDirect()
      const normalizedHead =
        headId && repository.messages.some(({ message }) => message.id === headId)
          ? headId
          : undefined
      if (repository.headId === normalizedHead) return
      await this.write({
        messages: repository.messages,
        ...(normalizedHead ? { headId: normalizedHead } : {}),
      })
    })
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.operation.then(operation, operation)
    this.operation = result.catch(() => undefined)
    return result
  }

  private async loadDirect() {
    const value = await this.store.get<unknown>(getStoreKey(this.workspaceKey))
    return normalizeStoredRepository(value)
  }

  private async write(repository: ExportedMessageRepository) {
    await this.store.set(getStoreKey(this.workspaceKey), repository)
    await this.store.save()
  }
}

export function normalizeStoredRepository(value: unknown): ExportedMessageRepository {
  if (!isRecord(value) || !Array.isArray(value.messages)) return { messages: [] }

  const messages: ExportedMessageRepositoryItem[] = []
  const seenIds = new Set<string>()
  for (const candidate of value.messages) {
    if (!isRecord(candidate) || !isRecord(candidate.message)) continue
    const message = normalizeStoredMessage(candidate.message)
    if (!message || seenIds.has(message.id)) continue
    const parentId = typeof candidate.parentId === 'string' ? candidate.parentId : null
    const runConfig =
      isRecord(candidate.runConfig) &&
      (candidate.runConfig.custom === undefined || isRecord(candidate.runConfig.custom))
        ? { custom: candidate.runConfig.custom }
        : undefined
    messages.push({
      message,
      parentId,
      ...(runConfig ? { runConfig } : {}),
    })
    seenIds.add(message.id)
  }

  // A corrupted/mid-write parent link must never make the entire Ask panel fail.
  const linkedIds = new Set<string>()
  const normalized = messages.map((item) => {
    const normalizedItem = {
      ...item,
      parentId: item.parentId && linkedIds.has(item.parentId) ? item.parentId : null,
    }
    linkedIds.add(item.message.id)
    return normalizedItem
  })
  const candidateHead = typeof value.headId === 'string' ? value.headId : undefined

  return {
    messages: normalized,
    ...(candidateHead && seenIds.has(candidateHead) ? { headId: candidateHead } : {}),
  }
}

function normalizeStoredMessage(value: Record<string, unknown>): ThreadMessage | undefined {
  if (
    typeof value.id !== 'string' ||
    (value.role !== 'user' && value.role !== 'assistant' && value.role !== 'system') ||
    !Array.isArray(value.content)
  ) {
    return undefined
  }

  const createdAtValue = value.createdAt
  const createdAt =
    createdAtValue instanceof Date
      ? createdAtValue
      : new Date(typeof createdAtValue === 'string' ? createdAtValue : Date.now())
  if (Number.isNaN(createdAt.getTime())) return undefined

  try {
    return MessageRepository.fromArray([
      { ...value, createdAt } as ThreadMessageLike,
    ]).messages[0]?.message
  } catch {
    return undefined
  }
}

export function pruneAskHistory(
  input: ExportedMessageRepository,
  maxMessages = ASK_HISTORY_MAX_MESSAGES,
  maxBytes = ASK_HISTORY_MAX_BYTES,
): ExportedMessageRepository {
  let repository = normalizeStoredRepository(input)

  while (
    repository.messages.length > 1 &&
    (repository.messages.length > maxMessages || getSerializedSize(repository) > maxBytes)
  ) {
    const removedIds = getEarliestTurnIds(repository)
    if (removedIds.size === 0) break
    repository = deleteHistoryMessages(repository, removedIds)
  }

  return repository
}

function getEarliestTurnIds(repository: ExportedMessageRepository): Set<string> {
  const roots = repository.messages.filter(({ parentId }) => parentId === null)
  if (roots.length === 0) return new Set()
  roots.sort((a, b) => a.message.createdAt.getTime() - b.message.createdAt.getTime())

  const first = roots[0]
  const removed = new Set([first.message.id])
  if (first.message.role !== 'user') return removed

  for (const item of repository.messages) {
    if (item.parentId === first.message.id && item.message.role === 'assistant') {
      removed.add(item.message.id)
    }
  }
  return removed
}

export function deleteHistoryMessages(
  repository: ExportedMessageRepository,
  removedIds: ReadonlySet<string>,
): ExportedMessageRepository {
  if (removedIds.size === 0) return repository
  const byId = new Map(repository.messages.map((item) => [item.message.id, item]))

  const findNearestParent = (parentId: string | null): string | null => {
    let current = parentId
    const visited = new Set<string>()
    while (current && removedIds.has(current) && !visited.has(current)) {
      visited.add(current)
      current = byId.get(current)?.parentId ?? null
    }
    return current && byId.has(current) && !removedIds.has(current) ? current : null
  }

  const messages = repository.messages
    .filter(({ message }) => !removedIds.has(message.id))
    .map((item) => ({ ...item, parentId: findNearestParent(item.parentId) }))
  const remainingIds = new Set(messages.map(({ message }) => message.id))
  const headId = repository.headId && remainingIds.has(repository.headId)
    ? repository.headId
    : findNewestHead(messages)

  return { messages, ...(headId ? { headId } : {}) }
}

function findNewestHead(messages: ExportedMessageRepositoryItem[]) {
  if (messages.length === 0) return undefined
  const parentIds = new Set(messages.map(({ parentId }) => parentId).filter(Boolean))
  return [...messages]
    .filter(({ message }) => !parentIds.has(message.id))
    .sort((a, b) => b.message.createdAt.getTime() - a.message.createdAt.getTime())[0]?.message.id
}

function getSerializedSize(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

interface LegacyAIChatMessage {
  key?: unknown
  role?: unknown
  content?: unknown
  status?: unknown
  timestamp?: unknown
  sources?: unknown
}

export interface LegacyAskMigrationResult {
  repository: ExportedMessageRepository
  provider?: string
  model?: string
}

export function parseLegacyAskStorage(raw: string | null): LegacyAskMigrationResult | undefined {
  if (!raw) return undefined

  try {
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return undefined
    const state = isRecord(parsed.state) ? parsed.state : parsed
    const rawMessages = Array.isArray(state.chatList) ? state.chatList : []
    const messages: ThreadMessageLike[] = []

    for (const [index, value] of rawMessages.entries()) {
      if (!isRecord(value)) continue
      const legacy = value as LegacyAIChatMessage
      if ((legacy.role !== 'user' && legacy.role !== 'ai') || typeof legacy.content !== 'string') {
        continue
      }
      const isActive = legacy.status === 'pending' || legacy.status === 'streaming'
      if (isActive && !legacy.content.trim()) continue

      const common = {
        id: typeof legacy.key === 'string' ? legacy.key : `legacy-${index}`,
        createdAt: new Date(
          typeof legacy.timestamp === 'number' && Number.isFinite(legacy.timestamp)
            ? legacy.timestamp
            : Date.now(),
        ),
      }
      if (legacy.role === 'user') {
        messages.push({ ...common, role: 'user', content: legacy.content })
      } else {
        const sources = normalizeLegacySources(legacy.sources)
        messages.push({
          ...common,
          role: 'assistant',
          content: [{ type: 'text', text: legacy.content }, ...sources],
          status:
            legacy.status === 'done'
              ? { type: 'complete', reason: 'stop' }
              : {
                  type: 'incomplete',
                  reason: legacy.status === 'error' ? 'error' : 'cancelled',
                },
        })
      }
    }

    const aiProvider = typeof state.aiProvider === 'string' ? state.aiProvider : undefined
    const currentModels = isRecord(state.aiProviderCurModel) ? state.aiProviderCurModel : undefined
    const currentModel =
      aiProvider && currentModels && typeof currentModels[aiProvider] === 'string'
        ? (currentModels[aiProvider] as string)
        : undefined

    return {
      repository: MessageRepository.fromArray(messages),
      provider: aiProvider,
      model: currentModel,
    }
  } catch {
    return undefined
  }
}

function normalizeLegacySources(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((source, index) => {
    if (!isRecord(source) || typeof source.url !== 'string') return []
    return [{
      type: 'source' as const,
      sourceType: 'url' as const,
      id: typeof source.id === 'string' ? source.id : `legacy-source-${index}`,
      url: source.url,
      ...(typeof source.title === 'string' ? { title: source.title } : {}),
    }]
  })
}

export async function migrateLegacyAskStorage(options: {
  workspaceKey: string
  setModelPreference: (provider: string, model: string) => void
  storage?: Pick<Storage, 'getItem' | 'removeItem'>
  store?: AskHistoryStore
}): Promise<boolean> {
  const storage = options.storage ?? localStorage
  const raw = storage.getItem(LEGACY_AI_STORAGE_KEY)
  const migration = parseLegacyAskStorage(raw)
  if (!migration) return false

  const adapter = new TauriAskThreadHistoryAdapter(
    options.workspaceKey,
    options.store ?? getSharedStore(),
  )
  const existing = await adapter.load()
  const migrationIds = new Set(
    migration.repository.messages.map(({ message }) => message.id),
  )
  const existingIds = new Set(existing.messages.map(({ message }) => message.id))
  const existingIsMigrationSubset = existing.messages.every(({ message }) =>
    migrationIds.has(message.id),
  )
  const mergedMessages = [
    ...existing.messages,
    ...migration.repository.messages.filter(({ message }) => !existingIds.has(message.id)),
  ]
  const headId = existingIsMigrationSubset
    ? migration.repository.headId
    : existing.headId ?? migration.repository.headId
  await adapter.replace({
    messages: mergedMessages,
    ...(headId ? { headId } : {}),
  })
  if (migration.provider && migration.model) {
    options.setModelPreference(migration.provider, migration.model)
  }
  storage.removeItem(LEGACY_AI_STORAGE_KEY)
  return true
}

export function exportAskHistoryMarkdown(repository: ExportedMessageRepository): string {
  const branch = getHeadBranch(repository)
  return branch
    .flatMap((message) => {
      const text = message.content
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('\n')
        .trim()
      const attachments =
        message.role === 'user' && message.attachments.length > 0
          ? `\n\n${message.attachments.map(({ name }) => `- 📎 ${name}`).join('\n')}`
          : ''
      const sources =
        message.role === 'assistant'
          ? message.content
              .filter((part) => part.type === 'source' && part.sourceType === 'url')
              .map((part) => `- [${part.title || part.url}](${part.url})`)
          : []
      if (!text && !attachments && sources.length === 0) return []
      const heading = message.role === 'user' ? '## You' : '## Assistant'
      return [`${heading}\n\n${text}${attachments}${
        sources.length ? `\n\n### Sources\n\n${sources.join('\n')}` : ''
      }`]
    })
    .join('\n\n')
}

function getHeadBranch(repository: ExportedMessageRepository): ThreadMessage[] {
  const byId = new Map(repository.messages.map((item) => [item.message.id, item]))
  let currentId = repository.headId || findNewestHead(repository.messages)
  const reversed: ThreadMessage[] = []
  const visited = new Set<string>()
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId)
    const item = byId.get(currentId)
    if (!item) break
    reversed.push(item.message)
    currentId = item.parentId || undefined
  }
  return reversed.reverse()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
