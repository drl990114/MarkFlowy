import type { StableFileSnapshot } from './fileSnapshot'
import {
  DEFAULT_TEXT_METADATA,
  sameTextFormat,
  textLineEndings,
  type TextFileFormat,
  type TextFileMetadata,
  type TextWriteOptions,
} from './textFileFormat'

export interface FileSaveSnapshot {
  content: string | undefined
  revision: number
  textOptions: TextWriteOptions
}

interface FileSaveState {
  content: string | undefined
  diskRevision: string | undefined
  hasContent: boolean
  revision: number
  tail: Promise<void>
  text: TextFileMetadata
  savedContent?: string
  savedFormat?: TextFileFormat
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
  private readonly listeners = new Set<() => void>()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener())
  }

  getTextMetadata(fileId: string): TextFileMetadata {
    return this.states.get(fileId)?.text ?? DEFAULT_TEXT_METADATA
  }

  recordSaveError(fileId: string, message: string): boolean {
    const state = this.getOrCreateState(fileId)
    if (state.text.saveError === message) return false
    state.text = { ...state.text, saveError: message }
    this.notify()
    return true
  }

  getWriteOptions(fileId: string): TextWriteOptions {
    const state = this.getOrCreateState(fileId)
    return {
      format: state.text.format,
      originalFormat: state.savedFormat,
      encodingConfirmed: !state.text.decoding.needsConfirmation,
    }
  }

  getPersistedFormat(fileId: string): TextFileFormat | undefined {
    const text = this.getTextMetadata(fileId)
    return text.decoding.needsConfirmation ? undefined : text.format
  }

  setSavedBaseline(fileId: string, snapshot: StableFileSnapshot): void {
    const state = this.getOrCreateState(fileId)
    state.savedContent = snapshot.content
    state.savedFormat = snapshot.text?.format ?? DEFAULT_TEXT_METADATA.format
  }

  loadSnapshot(fileId: string, snapshot: StableFileSnapshot): void {
    const state = this.getOrCreateState(fileId)
    this.recordContent(fileId, snapshot.content)
    state.diskRevision = snapshot.revision
    state.text = snapshot.text ?? DEFAULT_TEXT_METADATA
    state.savedContent = snapshot.content
    state.savedFormat = state.text.format
    state.revision += 1
    this.notify()
  }

  recordFormat(fileId: string, format: TextFileFormat, confirmed = true): void {
    const state = this.getOrCreateState(fileId)
    if (
      sameTextFormat(state.text.format, format) &&
      state.text.decoding.needsConfirmation === !confirmed
    )
      return
    state.text = {
      ...state.text,
      format: { ...format },
      decoding: {
        ...state.text.decoding,
        source: confirmed ? 'user' : 'unknown',
        needsConfirmation: !confirmed,
      },
    }
    state.revision += 1
    this.notify()
  }

  hasFormatChanges(fileId: string): boolean {
    const state = this.states.get(fileId)
    return (
      !!state &&
      !sameTextFormat(state.text.format, state.savedFormat ?? DEFAULT_TEXT_METADATA.format)
    )
  }

  isAtSavedSnapshot(fileId: string): boolean {
    const state = this.states.get(fileId)
    return (
      !!state &&
      state.savedContent !== undefined &&
      state.content === state.savedContent &&
      sameTextFormat(state.text.format, state.savedFormat)
    )
  }

  acknowledgeSaved(fileId: string, snapshot: FileSaveSnapshot, diskRevision: string): void {
    const state = this.getOrCreateState(fileId)
    const converted = !sameTextFormat(state.savedFormat, snapshot.textOptions.format)
    state.diskRevision = diskRevision
    state.savedContent = snapshot.content
    state.savedFormat = snapshot.textOptions.format
    state.text = {
      ...state.text,
      saveError: undefined,
      lineEndings: textLineEndings(state.content ?? ''),
      decoding: {
        ...state.text.decoding,
        byteRoundTrip: converted || state.text.decoding.byteRoundTrip,
      },
    }
    this.notify()
  }

  private getOrCreateState(fileId: string): FileSaveState {
    let state = this.states.get(fileId)
    if (!state) {
      state = {
        content: undefined,
        diskRevision: undefined,
        hasContent: false,
        revision: 0,
        tail: Promise.resolve(),
        text: DEFAULT_TEXT_METADATA,
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

  runExclusive<T>(fileId: string, run: () => Promise<T>): Promise<T> {
    const state = this.getOrCreateState(fileId)
    const task = state.tail.then(run)
    state.tail = task.then(
      () => undefined,
      () => undefined,
    )
    return task
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
      this.notify()
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
          textOptions: this.getWriteOptions(fileId),
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
