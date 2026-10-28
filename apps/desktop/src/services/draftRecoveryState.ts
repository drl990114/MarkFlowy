import type { OpeningReadPriority } from '@/components/EditorArea/openingReadQueue'
import type { RecoveryDocument } from './draftSessionFormat'

interface PendingRecovery {
  recover: (priority: OpeningReadPriority) => Promise<void>
  snapshot: () => RecoveryDocument
  keepAndClose?: () => Promise<void>
}

const pending = new Map<string, PendingRecovery>()
const discoveries = new Set<symbol>()
const completions = new Map<string, { version: number }>()
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((listener) => listener())

/** Until draft sources are indexed, a clean cached tab may still own unsaved
 * content. Keep preview replacement blocked without changing its saved identity. */
export const isDraftRecoveryDiscoveryPending = () => discoveries.size > 0

export function beginDraftRecoveryDiscovery(): () => void {
  const token = Symbol('draft-recovery-discovery')
  discoveries.add(token)
  return () => { discoveries.delete(token) }
}

/** Only successful recovery wakes an error surface. Cancellation also releases
 * the pending gate, but does not make its placeholder safe to mount. */
export const draftRecoveryCompletion = (fileId: string) => completions.get(fileId)?.version ?? 0
export const subscribeDraftRecovery = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const isDraftRecoveryPending = (fileId: string) => pending.has(fileId)
export const pendingDraftSnapshot = (fileId: string) => pending.get(fileId)?.snapshot()
export const pendingDraftRecoveryIds = () => [...pending.keys()]
export const canKeepDraftRecovery = (fileId: string) => !!pending.get(fileId)?.keepAndClose

export async function keepDraftRecoveryAndClose(fileId: string) {
  const entry = pending.get(fileId)
  if (!entry) return
  if (!entry.keepAndClose) throw new Error('The pending draft cannot be preserved for close.')
  await entry.keepAndClose()
}

/** Register before publishing a draft, so editors/history cannot observe half-recovered state. */
export function registerDraftRecovery(
  fileId: string,
  recover: (priority: OpeningReadPriority) => Promise<void> | void,
  snapshot: PendingRecovery['snapshot'] = () => { throw new Error('The pending draft has no recovery reference.') },
  keepAndClose?: PendingRecovery['keepAndClose'],
) {
  let resolve!: () => void
  const settled = new Promise<void>((done) => { resolve = done })
  const completion = { version: draftRecoveryCompletion(fileId) }
  completions.set(fileId, completion)
  let completed = false
  const entry: PendingRecovery = {
    recover: async (priority) => {
      await (recover(priority) ?? settled)
      if (!completed && !pending.has(fileId) && completions.get(fileId) === completion) {
        completed = true
        completion.version++
        notify()
      }
    }, snapshot, keepAndClose,
  }
  pending.set(fileId, entry)
  notify()
  return () => {
    if (pending.get(fileId) === entry) {
      pending.delete(fileId)
      // Closing a retained draft also releases CLI startup, while the unchanged
      // completion version keeps its unloaded editor from mounting.
      notify()
    }
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
