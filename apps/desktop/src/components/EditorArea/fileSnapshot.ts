import type { FileSysResult } from '@/helper/filesys'
import { invoke } from '@tauri-apps/api/core'

export interface StableFileSnapshot {
  content: string
  revision: string
  status: 'success'
}

export type FileSnapshotResult =
  | StableFileSnapshot
  | { result: FileSysResult; status: 'unavailable' }
  | { status: 'unstable' }

const openingSnapshots = new Map<string, Promise<FileSnapshotResult>>()

/**
 * Rust validates the raw bytes and captures the matching write revision in one command.
 * Only sibling opens may share a pending read. Save/watch checks must observe disk
 * anew, including when an earlier open is still in flight. Never cache settled reads.
 */
export function readStableFileSnapshot(
  filePath: string,
  options: { reuseInFlight?: boolean } = {},
): Promise<FileSnapshotResult> {
  if (!options.reuseInFlight) {
    return invoke<FileSnapshotResult>('get_file_snapshot', { filePath })
  }
  const pending = openingSnapshots.get(filePath)
  if (pending) return pending
  const snapshot = invoke<FileSnapshotResult>('get_file_snapshot', { filePath }).finally(() => {
    if (openingSnapshots.get(filePath) === snapshot) openingSnapshots.delete(filePath)
  })
  openingSnapshots.set(filePath, snapshot)
  return snapshot
}
