type ScheduleMicrotask = (callback: () => void) => void

export class EditorInstanceLifecycle {
  private readonly counts = new Map<string, number>()
  private readonly cleanupTokens = new Map<string, number>()

  constructor(
    private readonly scheduleMicrotask: ScheduleMicrotask = (cb) => queueMicrotask(cb)
  ) {}

  mount(fileId: string): number {
    const count = (this.counts.get(fileId) ?? 0) + 1
    this.counts.set(fileId, count)
    this.cleanupTokens.set(fileId, (this.cleanupTokens.get(fileId) ?? 0) + 1)
    return count
  }

  hasInstances(fileId: string): boolean {
    return (this.counts.get(fileId) ?? 0) > 0
  }

  unmount(fileId: string, cleanup: () => void): number {
    const count = Math.max(0, (this.counts.get(fileId) ?? 1) - 1)
    this.counts.set(fileId, count)
    const token = (this.cleanupTokens.get(fileId) ?? 0) + 1
    this.cleanupTokens.set(fileId, token)

    if (count === 0) {
      this.scheduleMicrotask(() => {
        if (this.counts.get(fileId) !== 0 || this.cleanupTokens.get(fileId) !== token) return

        this.counts.delete(fileId)
        this.cleanupTokens.delete(fileId)
        cleanup()
      })
    }

    return count
  }
}
