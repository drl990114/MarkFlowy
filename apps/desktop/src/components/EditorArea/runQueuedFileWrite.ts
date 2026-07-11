import type { SavePathCoordinator } from './savePathCoordinator'

export type QueuedFileWriteResult<T> = { status: 'missing-path' } | { status: 'written'; value: T }

interface RunQueuedFileWriteParams<T> {
  coordinator: Pick<SavePathCoordinator, 'runFileMutation'>
  getCurrentPath: () => string | undefined
  write: (currentPath: string) => Promise<T>
}

/** Re-reads the file path only after prior rename/move mutations have committed. */
export function runQueuedFileWrite<T>({
  coordinator,
  getCurrentPath,
  write,
}: RunQueuedFileWriteParams<T>): Promise<QueuedFileWriteResult<T>> {
  return coordinator.runFileMutation(async () => {
    const currentPath = getCurrentPath()
    if (!currentPath) return { status: 'missing-path' }

    return {
      status: 'written',
      value: await write(currentPath),
    }
  })
}
