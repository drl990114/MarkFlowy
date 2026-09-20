type SaveHandler = () => Promise<boolean>

interface DeferredSave {
  mounts: Set<() => void>
  request?: Promise<boolean>
  complete?: (handler?: SaveHandler) => void
}

const entries = new Map<string, DeferredSave>()

/** Mount an unvisited editor only when an explicit save operation needs its existing save path. */
export function registerDeferredEditorSave(fileId: string, mount: () => void) {
  let entry = entries.get(fileId)
  if (!entry) {
    entry = { mounts: new Set() }
    entries.set(fileId, entry)
  }
  entry.mounts.add(mount)
  return () => {
    entry.mounts.delete(mount)
    if (!entry.mounts.size) {
      entry.complete?.()
      if (entries.get(fileId) === entry) entries.delete(fileId)
    }
  }
}

export function completeDeferredEditorSave(fileId: string, handler?: SaveHandler) {
  entries.get(fileId)?.complete?.(handler)
}

export function getDeferredEditorSave(fileId: string): SaveHandler | undefined {
  const entry = entries.get(fileId)
  if (!entry) return
  return () => {
    if (entry.request) return entry.request
    const request = new Promise<boolean>((resolve, reject) => {
      entry.complete = (handler) => {
        entry.complete = undefined
        if (handler) void handler().then(resolve, reject)
        else resolve(false)
      }
      const mount = entry.mounts.values().next().value
      if (mount) mount()
      else entry.complete()
    })
    entry.request = request
    void request.finally(() => {
      if (entry.request === request) entry.request = undefined
    }).catch(() => undefined)
    return request
  }
}
