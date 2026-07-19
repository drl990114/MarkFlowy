export interface ResourceRegistration<T> {
  current?: T
  currentChanged: boolean
}

export interface ResourceRemoval<T> {
  current?: T
  currentChanged: boolean
  empty: boolean
}

/**
 * Keeps per-instance resources while exposing one current resource per file.
 * The compatibility resource can follow the active editor instance and fall
 * back to a surviving instance when its current owner unmounts.
 */
export class InstanceResourceRegistry<T> {
  private readonly entries = new Map<string, Map<string, T>>()
  private readonly currentOwners = new Map<string, string>()

  register(fileId: string, instanceId: string, resource: T): ResourceRegistration<T> {
    const fileEntries = this.entries.get(fileId) ?? new Map<string, T>()
    fileEntries.set(instanceId, resource)
    this.entries.set(fileId, fileEntries)

    const currentOwner = this.currentOwners.get(fileId)
    const currentChanged = !currentOwner || currentOwner === instanceId

    if (currentChanged) {
      this.currentOwners.set(fileId, instanceId)
      return { current: resource, currentChanged: true }
    }

    const current = fileEntries.get(currentOwner)
    return current === undefined ? { currentChanged: false } : { current, currentChanged: false }
  }

  get(fileId: string, instanceId: string): T | undefined {
    return this.entries.get(fileId)?.get(instanceId)
  }

  promote(fileId: string, instanceId: string): T | undefined {
    const resource = this.entries.get(fileId)?.get(instanceId)
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
      return { currentChanged: wasCurrent, empty: true }
    }

    if (!wasCurrent) {
      const currentOwner = this.currentOwners.get(fileId)
      return {
        current: currentOwner ? fileEntries.get(currentOwner) : undefined,
        currentChanged: false,
        empty: false,
      }
    }

    const [fallbackInstanceId, fallbackResource] = Array.from(fileEntries.entries()).at(-1)!
    this.currentOwners.set(fileId, fallbackInstanceId)
    return { current: fallbackResource, currentChanged: true, empty: false }
  }
}
