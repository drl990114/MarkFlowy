import type { OpeningReadPriority } from '@/components/EditorArea/openingReadQueue'
import type { RecoveryDocument } from './draftSessionFormat'

interface PendingRecovery {
  recover: (priority: OpeningReadPriority) => Promise<void>
  snapshot: () => RecoveryDocument
}

const pending = new Map<string, PendingRecovery>()

export const isDraftRecoveryPending = (fileId: string) => pending.has(fileId)
export const pendingDraftSnapshot = (fileId: string) => pending.get(fileId)?.snapshot()

/** Register before publishing a draft, so editors/history cannot observe half-recovered state. */
export function registerDraftRecovery(
  fileId: string,
  recover: (priority: OpeningReadPriority) => Promise<void> | void,
  snapshot: PendingRecovery['snapshot'] = () => { throw new Error('The pending draft has no recovery reference.') },
) {
  let resolve!: () => void
  const settled = new Promise<void>((done) => { resolve = done })
  const entry: PendingRecovery = {
    recover: async (priority) => { await (recover(priority) ?? settled) }, snapshot,
  }
  pending.set(fileId, entry)
  return () => {
    if (pending.get(fileId) === entry) pending.delete(fileId)
    resolve()
  }
}

export async function waitForDraftRecovery(
  fileId: string,
  priority: OpeningReadPriority = 'foreground',
) {
  const entry = pending.get(fileId)
  await entry?.recover(priority)
}

/** Destructive transitions must see every dirty draft before asking to save or discard. */
export async function waitForAllDraftRecovery() {
  while (pending.size) {
    // Close, workspace switch and CLI must also start work deferred behind first paint.
    // A failure rejects the transition; it never exposes an unloaded draft as empty.
    await Promise.all([...pending.values()].map((entry) => entry.recover('background')))
  }
}
