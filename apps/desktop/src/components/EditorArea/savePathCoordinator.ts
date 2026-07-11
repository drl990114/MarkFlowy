import { getPathIdentityKey } from '@/helper/pathIdentity'

export interface SavePathLease {
  activate: (targetPath: string) => void
  enableOtherEditorBarrier: () => void
  protectFileIds: (fileIds: string[]) => void
  protectPaths: (paths: string[]) => void
}

interface ActivePathReservation {
  ownerFileId: string
  otherEditorBarrier: boolean
  protectedFileIds: Set<string>
  protectedPathKeys: Set<string>
  targetPath?: string
}

type Listener = () => void

export const FILE_MUTATION_QUEUE_KEY = 'save-as:global'

/** Serializes renderer filesystem mutations and exposes active Save As reservations to editors. */
export class SavePathCoordinator {
  private readonly activeReservations = new Map<string, ActivePathReservation>()
  private readonly listeners = new Set<Listener>()
  private readonly tails = new Map<string, Promise<void>>()
  private nextMutationId = 0

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener())
  }

  isFileReserved(fileId: string, path?: string): boolean {
    for (const reservation of this.activeReservations.values()) {
      if (reservation.ownerFileId === fileId) continue
      if (reservation.otherEditorBarrier) return true
      if (reservation.protectedFileIds.has(fileId)) return true
      if (path && reservation.protectedPathKeys.has(getPathIdentityKey(path))) return true
      if (
        path &&
        reservation.targetPath &&
        getPathIdentityKey(path) === getPathIdentityKey(reservation.targetPath)
      ) {
        return true
      }
    }
    return false
  }

  async runExclusive<T>(
    queueKey: string,
    ownerFileId: string,
    operation: (lease: SavePathLease) => Promise<T>,
  ): Promise<T> {
    const previousTail = this.tails.get(queueKey) ?? Promise.resolve()
    let releaseTurn: (() => void) | undefined
    const turn = new Promise<void>((resolve) => {
      releaseTurn = resolve
    })
    const tail = previousTail.then(() => turn)
    this.tails.set(queueKey, tail)

    await previousTail

    let activated = false
    const ensureReservation = (): ActivePathReservation => {
      const existingReservation = this.activeReservations.get(queueKey)
      if (activated && existingReservation?.ownerFileId === ownerFileId) {
        return existingReservation
      }

      activated = true
      const reservation: ActivePathReservation = {
        ownerFileId,
        otherEditorBarrier: false,
        protectedFileIds: new Set(),
        protectedPathKeys: new Set(),
      }
      this.activeReservations.set(queueKey, reservation)
      return reservation
    }
    const lease: SavePathLease = {
      activate: (targetPath) => {
        const reservation = ensureReservation()
        reservation.targetPath = targetPath
        this.emit()
      },
      enableOtherEditorBarrier: () => {
        const reservation = this.activeReservations.get(queueKey)
        if (!reservation || reservation.ownerFileId !== ownerFileId) return
        reservation.otherEditorBarrier = true
        this.emit()
      },
      protectFileIds: (fileIds) => {
        if (fileIds.length === 0) return
        const reservation = ensureReservation()
        let changed = false
        fileIds.forEach((fileId) => {
          if (!fileId || reservation.protectedFileIds.has(fileId)) return
          reservation.protectedFileIds.add(fileId)
          changed = true
        })
        if (changed) this.emit()
      },
      protectPaths: (paths) => {
        if (paths.length === 0) return
        const reservation = ensureReservation()
        let changed = false
        paths.forEach((path) => {
          if (!path) return
          const pathKey = getPathIdentityKey(path)
          if (reservation.protectedPathKeys.has(pathKey)) return
          reservation.protectedPathKeys.add(pathKey)
          changed = true
        })
        if (changed) this.emit()
      },
    }

    try {
      return await operation(lease)
    } finally {
      if (activated && this.activeReservations.get(queueKey)?.ownerFileId === ownerFileId) {
        this.activeReservations.delete(queueKey)
        this.emit()
      }

      releaseTurn?.()
      void tail.then(() => {
        if (this.tails.get(queueKey) === tail) {
          this.tails.delete(queueKey)
        }
      })
    }
  }

  /**
   * Runs a filesystem mutation in the same critical section as Save As.
   * The caller keeps backend work and its tree/cache commit inside `operation`.
   */
  runFileMutation<T>(operation: (lease: SavePathLease) => Promise<T>): Promise<T> {
    this.nextMutationId += 1
    return this.runExclusive(
      FILE_MUTATION_QUEUE_KEY,
      `filesystem-mutation:${this.nextMutationId}`,
      operation,
    )
  }
}

export const savePathCoordinator = new SavePathCoordinator()
