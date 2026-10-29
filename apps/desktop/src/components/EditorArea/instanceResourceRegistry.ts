export interface ResourceRegistration<T> {
  current?: T
  currentChanged: boolean
}

export interface ResourceRemoval<T> {
  current?: T
  currentChanged: boolean
  empty: boolean
}

interface ResourceEntry<T> {
  resource: T
  groupId?: string
}

/**
 * Keeps per-instance resources while exposing one current resource per file.
 * The compatibility resource can follow the active editor instance and fall
 * back to a surviving instance when its current owner unmounts.
 */
export class InstanceResourceRegistry<T> {
  private readonly entries = new Map<string, Map<string, ResourceEntry<T>>>()
  private readonly currentOwners = new Map<string, string>()
  private readonly listeners = new Set<() => void>()

  register(
    fileId: string,
    instanceId: string,
    resource: T,
    groupId?: string,
  ): ResourceRegistration<T> {
    const fileEntries = this.entries.get(fileId) ?? new Map<string, ResourceEntry<T>>()
    const previous = fileEntries.get(instanceId)
    fileEntries.set(instanceId, { resource, groupId })
    this.entries.set(fileId, fileEntries)

    const currentOwner = this.currentOwners.get(fileId)
    const currentChanged = !currentOwner || currentOwner === instanceId

    if (currentChanged) {
      this.currentOwners.set(fileId, instanceId)
    }
    if (!previous || previous.resource !== resource || previous.groupId !== groupId) this.notify()
    if (currentChanged) return { current: resource, currentChanged: true }
    const current = fileEntries.get(currentOwner)?.resource
    return current === undefined ? { currentChanged: false } : { current, currentChanged: false }
  }

  get(fileId: string, instanceId: string): T | undefined {
    return this.entries.get(fileId)?.get(instanceId)?.resource
  }

  getForGroup(fileId: string, groupId: string): T | undefined {
    let resource: T | undefined
    // A replacement may mount before the old instance cleans up. Prefer the
    // newer instance in this group without borrowing another pane's resource.
    for (const entry of this.entries.get(fileId)?.values() ?? []) {
      if (entry.groupId === groupId) resource = entry.resource
    }
    return resource
  }

  getAll(fileId: string): T[] {
    return Array.from(this.entries.get(fileId)?.values() ?? [], (entry) => entry.resource)
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener())
  }

  promote(fileId: string, instanceId: string): T | undefined {
    const resource = this.get(fileId, instanceId)
    this.currentOwners.set(fileId, instanceId)
    return resource
  }

  remove(fileId: string, instanceId: string): ResourceRemoval<T> {
    const fileEntries = this.entries.get(fileId)
    const wasCurrent = this.currentOwners.get(fileId) === instanceId
    const hadResource = fileEntries?.delete(instanceId) ?? false

    if (!hadResource && !wasCurrent) {
      return { currentChanged: false, empty: !fileEntries?.size }
    }

    if (!fileEntries || fileEntries.size === 0) {
      this.entries.delete(fileId)
      if (wasCurrent) {
        this.currentOwners.delete(fileId)
      }
      if (hadResource) this.notify()
      return { currentChanged: wasCurrent, empty: true }
    }

    if (!wasCurrent) {
      const currentOwner = this.currentOwners.get(fileId)
      this.notify()
      return {
        current: currentOwner ? fileEntries.get(currentOwner)?.resource : undefined,
        currentChanged: false,
        empty: false,
      }
    }

    const [fallbackInstanceId, fallbackEntry] = Array.from(fileEntries.entries()).at(-1)!
    this.currentOwners.set(fileId, fallbackInstanceId)
    if (hadResource) this.notify()
    return { current: fallbackEntry.resource, currentChanged: true, empty: false }
  }
}
