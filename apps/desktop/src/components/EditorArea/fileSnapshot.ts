import { FileResultCode, type FileSysResult } from '@/helper/filesys'
import { invoke } from '@tauri-apps/api/core'
import { getFileWriteRevision } from './conditionalFileWrite'

export interface StableFileSnapshot {
  content: string
  revision: string
  status: 'success'
}

export type FileSnapshotResult =
  | StableFileSnapshot
  | { result: FileSysResult; status: 'unavailable' }
  | { status: 'unstable' }

export interface FileSnapshotReader {
  getRevision: (filePath: string) => Promise<string>
  readContent: (filePath: string) => Promise<FileSysResult>
}

const defaultReader: FileSnapshotReader = {
  getRevision: getFileWriteRevision,
  readContent: (filePath) =>
    invoke<FileSysResult>('get_file_content', {
      filePath,
    }),
}

/** Reads content between two matching revisions so watcher events never apply a partial write. */
export async function readStableFileSnapshot(
  filePath: string,
  reader: FileSnapshotReader = defaultReader,
  attempts = 3,
): Promise<FileSnapshotResult> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const revisionBefore = await reader.getRevision(filePath)
    const result = await reader.readContent(filePath)

    if (result.code !== FileResultCode.Success) {
      return { result, status: 'unavailable' }
    }

    const revisionAfter = await reader.getRevision(filePath)
    if (revisionBefore === revisionAfter) {
      return {
        content: result.content,
        revision: revisionAfter,
        status: 'success',
      }
    }
  }

  return { status: 'unstable' }
}
