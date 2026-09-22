import type { FileSysResult } from '@/helper/filesys'
import { invoke } from '@tauri-apps/api/core'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import {
  OpeningReadQueue,
  type OpeningReadOptions,
  type OpeningReadPriority,
} from './openingReadQueue'
import type { TextEncoding, TextFileMetadata } from './textFileFormat'

export interface StableFileSnapshot {
  content: string
  revision: string
  status: 'success'
  text?: TextFileMetadata
}

export type FileSnapshotResult =
  | StableFileSnapshot
  | { result: FileSysResult; status: 'unavailable' }
  | { status: 'unstable' }

const openingSnapshots = new OpeningReadQueue<FileSnapshotResult>()

export const promoteOpeningRead = (path: string, scope: object, priority: OpeningReadPriority) =>
  openingSnapshots.promote(getPathIdentityKey(path), scope, priority)

/**
 * Rust validates the raw bytes and captures the matching write revision in one command.
 * Only sibling opens may share a pending read. Save/watch checks must observe disk
 * anew, including when an earlier open is still in flight. Never cache settled reads.
 */
export function readStableFileSnapshot(
  filePath: string,
  options: OpeningReadOptions & { reuseInFlight?: boolean; encoding?: TextEncoding } = {},
): Promise<FileSnapshotResult> {
  if (!options.reuseInFlight || options.encoding) {
    return invoke<FileSnapshotResult>('get_file_snapshot', {
      filePath,
      ...(options.encoding ? { encoding: options.encoding } : {}),
    })
  }
  return openingSnapshots.read(
    getPathIdentityKey(filePath),
    () => invoke<FileSnapshotResult>('get_file_snapshot', { filePath }),
    options,
  )
}
