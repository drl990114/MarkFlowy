import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getFileObjectByPath } from '@/helper/files'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import { logger } from '@/helper/logger'
import useRecentFilesStore, {
  parseRecentFilePaths,
  subscribeRecentFileMutations,
  type RecentFileMutation,
} from '@/stores/useRecentFilesStore'

export interface RecentFileSnapshot {
  revision: number
  paths: string[]
}

export async function startSharedRecentFileHistory() {
  let revision = -1
  let tail = Promise.resolve()
  const pending: RecentFileMutation[] = []
  const apply = (snapshot: RecentFileSnapshot) => {
    if (snapshot.revision <= revision) return
    revision = snapshot.revision
    const state = useRecentFilesStore.getState()
    const fileIds = new Map(
      state.entries.flatMap((entry) =>
        entry.path && entry.fileId ? [[getPathIdentityKey(entry.path), entry.fileId] as const] : [],
      ),
    )
    useRecentFilesStore.setState({ shared: true })
    state.replaceEntries([
      ...state.entries.filter((entry) => !entry.path),
      ...parseRecentFilePaths(snapshot.paths).map((entry) =>
        entry.path
          ? {
              ...entry,
              fileId:
                getFileObjectByPath(entry.path)?.id ?? fileIds.get(getPathIdentityKey(entry.path)),
            }
          : entry,
      ),
    ])
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
