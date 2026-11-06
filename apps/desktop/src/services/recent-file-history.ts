import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getFileObjectByPath } from '@/helper/files'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import { logger } from '@/helper/logger'
import useRecentFilesStore, {
  getRecentFileKey,
  parseRecentFilePaths,
  subscribeRecentFileMutations,
  type RecentFile,
  type RecentFileMutation,
} from '@/stores/useRecentFilesStore'

export interface RecentFileSnapshot {
  revision: number
  paths: string[]
}

function mergeLocalDrafts(current: readonly RecentFile[], next: RecentFile[], initial: boolean) {
  const positions = new Map(current.flatMap((entry, index) =>
    entry.path ? [[getRecentFileKey(entry), index] as const] : [],
  ))
  // Visits move saved paths towards the front. Retain anchors in their old
  // relative order so a remotely revisited file cannot carry an older draft up.
  const retained = new Set<string>()
  let previous = current.length
  for (let index = next.length - 1; index >= 0; index--) {
    const key = getRecentFileKey(next[index])
    const position = positions.get(key)
    if (position !== undefined && position < previous) {
      retained.add(key)
      previous = position
    }
  }
  const before = new Map<string, RecentFile[]>()
  let drafts: RecentFile[] = []
  for (const entry of current) {
    if (!entry.path) drafts.push(entry)
    else if (retained.has(getRecentFileKey(entry))) {
      before.set(getRecentFileKey(entry), drafts)
      drafts = []
    }
  }
  const merged = next.flatMap((entry) => [...(before.get(getRecentFileKey(entry)) ?? []), entry])
  // An initial read contains historical visits, older than an already open draft.
  return initial && retained.size === 0 ? [...drafts, ...merged] : [...merged, ...drafts]
}

export async function startSharedRecentFileHistory() {
  let latest: RecentFileSnapshot | undefined
  let tail = Promise.resolve()
  const pending: RecentFileMutation[] = []
  const apply = (snapshot: RecentFileSnapshot) => {
    const initial = latest === undefined
    if (!latest || snapshot.revision > latest.revision) latest = snapshot
    // Native events can arrive before their command response. Keep the local
    // optimistic order until every queued mutation is acknowledged, then apply
    // the newest snapshot without replaying potentially committed mutations.
    if (pending.length) return
    const state = useRecentFilesStore.getState()
    const fileIds = new Map(
      state.entries.flatMap((entry) =>
        entry.path && entry.fileId ? [[getPathIdentityKey(entry.path), entry.fileId] as const] : [],
      ),
    )
    useRecentFilesStore.setState({ shared: true })
    const entries = parseRecentFilePaths(latest.paths).map((entry) =>
      entry.path
        ? {
            ...entry,
            fileId:
              getFileObjectByPath(entry.path)?.id ?? fileIds.get(getPathIdentityKey(entry.path)),
          }
        : entry,
    )
    state.replaceEntries(mergeLocalDrafts(state.entries, entries, initial))
  }
  // Subscribe before reading so another window cannot change history in the gap.
  const unlisten = await listen<RecentFileSnapshot>('recent-files-changed', ({ payload }) =>
    apply(payload),
  )
  try {
    apply(await invoke<RecentFileSnapshot>('recent_file_history', { mutation: { type: 'read' } }))
  } catch (error) {
    unlisten()
    throw error
  }
  const schedule = () => {
    tail = tail
      .catch(() => undefined)
      .then(async () => {
        while (pending.length) {
          const snapshot = await invoke<RecentFileSnapshot>('recent_file_history', {
            mutation: pending[0],
          })
          pending.shift()
          apply(snapshot)
        }
      })
    void tail.catch((error: unknown) => {
      logger.error('Failed to persist shared recent files', error)
    })
  }
  const unsubscribe = subscribeRecentFileMutations((mutation) => {
    pending.push(mutation)
    schedule()
  })
  const flush = async () => {
    if (pending.length) schedule()
    await tail
  }
  return {
    flush,
    dispose: async () => {
      unsubscribe()
      unlisten()
      await flush()
    },
  }
}
