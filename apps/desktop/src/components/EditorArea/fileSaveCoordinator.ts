export interface FileSaveSnapshot {
  content: string | undefined
  revision: number
}

interface FileSaveState {
  content: string | undefined
  diskRevision: string | undefined
  hasContent: boolean
  revision: number
  tail: Promise<void>
}

type SaveAttempt = (snapshot: FileSaveSnapshot) => Promise<boolean>

interface FileSaveOptions {
  canAttempt?: () => boolean
}

/**
 * Serializes every save for one file and retries with the newest shared
 * content when the document changes while an older write is in flight.
 */
export class FileSaveCoordinator {
  private readonly states = new Map<string, FileSaveState>()

  private getOrCreateState(fileId: string): FileSaveState {
    let state = this.states.get(fileId)
    if (!state) {
      state = {
        content: undefined,
        diskRevision: undefined,
        hasContent: false,
        revision: 0,
        tail: Promise.resolve(),
      }
      this.states.set(fileId, state)
    }
    return state
  }

  recordContent(fileId: string, content: string | undefined): number {
    const state = this.getOrCreateState(fileId)
    if (!state.hasContent || state.content !== content) {
      state.content = content
      state.hasContent = true
      state.revision += 1
    }
    return state.revision
  }

  getRevision(fileId: string): number {
    return this.states.get(fileId)?.revision ?? 0
  }

  getDiskRevision(fileId: string): string | undefined {
    return this.states.get(fileId)?.diskRevision
  }

  setDiskRevision(fileId: string, diskRevision: string): void {
    this.getOrCreateState(fileId).diskRevision = diskRevision
  }

  async waitForIdle(fileId: string): Promise<void> {
    while (true) {
      const state = this.states.get(fileId)
      if (!state) return

      const observedTail = state.tail
      await observedTail

      if (this.states.get(fileId) === state && state.tail === observedTail) return
    }
  }

  async releaseWhenIdle(
    fileId: string,
    canRelease: () => boolean,
    cleanup: () => void,
  ): Promise<boolean> {
    while (true) {
      const state = this.states.get(fileId)
      if (!state) {
        if (!canRelease()) return false
        cleanup()
        return true
      }

      const observedTail = state.tail
      await observedTail

      if (this.states.get(fileId) !== state || state.tail !== observedTail) continue
      if (!canRelease()) return false

      this.states.delete(fileId)
      cleanup()
      return true
    }
  }

  saveLatest(
    fileId: string,
    attempt: SaveAttempt,
    onLatestSaved?: (snapshot: FileSaveSnapshot) => void,
    options?: FileSaveOptions,
  ): Promise<boolean> {
    const state = this.getOrCreateState(fileId)

    const task = state.tail.then(async () => {
      while (true) {
        if (options?.canAttempt && !options.canAttempt()) return false

        const snapshot = {
          content: state.content,
          revision: state.revision,
        }
        const saved = await attempt(snapshot)

        if (!saved) return false
        if (options?.canAttempt && !options.canAttempt()) return false
        if (state.revision !== snapshot.revision) continue

        onLatestSaved?.(snapshot)
        return true
      }
    })

    // A failed/canceled save must not poison later saves in the same queue.
    state.tail = task.then(
      () => undefined,
      () => undefined,
    )

    return task
  }
}

export const fileSaveCoordinator = new FileSaveCoordinator()
