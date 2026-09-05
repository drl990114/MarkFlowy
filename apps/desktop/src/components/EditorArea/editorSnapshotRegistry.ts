import { InstanceResourceRegistry } from './instanceResourceRegistry'

export interface EditorSnapshotSource {
  canRead: () => boolean
  flush: () => boolean
  hasPending: () => boolean
  isVisible: () => boolean
  onSyncDemandChanged: (hasVisibleSibling: boolean) => void
}

interface SnapshotEntry extends EditorSnapshotSource {
  lastChange: number
}

/** Holds only live reader callbacks and ordering metadata, never document data. */
export class EditorSnapshotRegistry {
  private readonly sources = new InstanceResourceRegistry<SnapshotEntry>()
  private readonly reading = new Set<string>()
  private readonly publishing = new Map<string, Set<string>>()
  private sequence = 0

  register(fileId: string, instanceId: string, source: EditorSnapshotSource): () => void {
    const previous = this.sources.get(fileId, instanceId)
    this.sources.register(fileId, instanceId, {
      ...source,
      lastChange: previous?.lastChange ?? 0,
    })
    this.updateVisibility(fileId)
    return () => {
      this.sources.remove(fileId, instanceId)
      this.updateVisibility(fileId)
    }
  }

  changed(fileId: string, instanceId: string): void {
    const source = this.sources.get(fileId, instanceId)
    if (source) source.lastChange = ++this.sequence
  }

  updateVisibility(fileId: string): void {
    const sources = this.sources.getAll(fileId)
    for (const source of sources) {
      source.onSyncDemandChanged(sources.some((other) => other !== source && other.isVisible()))
    }
  }

  canRead(fileId: string): boolean {
    return this.sources.getAll(fileId).every((source) => source.canRead())
  }

  hasPending(fileId: string): boolean {
    return this.sources.getAll(fileId).some((source) => source.hasPending())
  }

  publish(fileId: string, instanceId: string, publish: () => boolean): boolean {
    if (!this.sources.get(fileId, instanceId)) return false
    const publishing = this.publishing.get(fileId) ?? new Set<string>()
    if (publishing.has(instanceId)) return false
    publishing.add(instanceId)
    this.publishing.set(fileId, publishing)
    try {
      return this.flushBefore(fileId, instanceId) && publish()
    } finally {
      publishing.delete(instanceId)
      if (publishing.size === 0) this.publishing.delete(fileId)
    }
  }

  // A later publication first consumes older pending authors. Their timers
  // cannot subsequently overwrite it, and pending local edits still reject
  // intermediate sibling broadcasts until their own latest value is read.
  flushBefore(fileId: string, instanceId: string): boolean {
    if (!this.canRead(fileId)) return false
    const source = this.sources.get(fileId, instanceId)
    if (!source) return true
    return this.sources.getAll(fileId)
      .filter((other) => other !== source && other.lastChange < source.lastChange && other.hasPending())
      .sort((left, right) => left.lastChange - right.lastChange)
      .every((other) => other.flush())
  }

  flush(fileId: string): boolean {
    // Publishing can synchronously notify sibling editors. A reentrant reader
    // must not receive the temporary cache between older and newer authors.
    if (this.reading.has(fileId) || this.publishing.has(fileId) || !this.canRead(fileId)) return false
    this.reading.add(fileId)
    try {
      const sources = this.sources.getAll(fileId)
        .filter((source) => source.hasPending())
        .sort((left, right) => left.lastChange - right.lastChange)
      for (const source of sources) {
        if (!this.canRead(fileId) || !source.flush()) return false
      }
      return this.canRead(fileId) && !this.hasPending(fileId)
    } finally {
      this.reading.delete(fileId)
    }
  }

  flushForRead(fileId: string): void {
    if (!this.canRead(fileId)) throw new Error('Finish composing before using this action.')
    if (!this.flush(fileId)) {
      throw new Error('Could not read the latest editor content. Please try again.')
    }
  }
}

export const editorSnapshotRegistry = new EditorSnapshotRegistry()
