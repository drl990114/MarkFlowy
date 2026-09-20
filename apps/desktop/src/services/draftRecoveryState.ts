import type { OpeningReadPriority } from '@/components/EditorArea/openingReadQueue'

interface PendingRecovery {
  settled: Promise<void>
  promote: (priority: OpeningReadPriority) => void
}

const pending = new Map<string, PendingRecovery>()

export const isDraftRecoveryPending = (fileId: string) => pending.has(fileId)

/** Register before publishing a draft, so editors/history cannot observe half-recovered state. */
export function registerDraftRecovery(
  fileId: string,
  promote: PendingRecovery['promote'],
) {
  let resolve!: () => void
  const entry: PendingRecovery = {
    settled: new Promise<void>((done) => { resolve = done }),
    promote,
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
  entry?.promote(priority)
  await entry?.settled
}

/** Destructive transitions must see every dirty draft before asking to save or discard. */
export async function waitForAllDraftRecovery() {
  while (pending.size) await Promise.all([...pending.values()].map((entry) => entry.settled))
}
