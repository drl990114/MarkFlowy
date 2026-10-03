import { fetch } from '@tauri-apps/plugin-http'

interface RemoteImageEntry {
  users: number
  controller?: AbortController
  objectUrl?: string
  promise: Promise<string>
}

export interface RemoteImageResources {
  resolve: (url: string) => Promise<string>
  /** Keep resources alive while an export outlives its editor. */
  retain: () => () => void
  dispose: () => void
}

// Only live owners keep entries. There is no app-session or idle Blob cache.
const sharedImages = new Map<string, RemoteImageEntry>()

const downloadImage = async (url: string, signal: AbortSignal): Promise<Blob> => {
  const response = await fetch(url, {
    maxRedirections: 5,
    method: 'GET',
    mode: 'cors',
    signal,
  })
  if (signal.aborted || !response.ok) {
    await response.body?.cancel()
    signal.throwIfAborted()
    throw new Error(`Failed to fetch remote image: ${response.status}`)
  }

  const blob = await response.blob()
  signal.throwIfAborted()
  // Tauri exposes headers separately from the Response internals; WebKit can
  // otherwise receive an untyped Blob for a remote SVG.
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase()
  return blob.type || !contentType?.startsWith('image/')
    ? blob
    : new Blob([blob], { type: contentType })
}

const createEntry = (url: string): RemoteImageEntry => {
  const controller = new AbortController()
  const entry: RemoteImageEntry = {
    users: 0,
    controller,
    promise: downloadImage(url, controller.signal)
      .then((blob) => {
        // Do not abort a completed native request when its Blob is released.
        entry.controller = undefined
        // A native request may settle after cancellation. Never register its
        // Blob URL once the final owner has gone away.
        controller.signal.throwIfAborted()
        entry.objectUrl = URL.createObjectURL(blob)
        return entry.objectUrl
      })
      .catch((error: unknown) => {
        entry.controller = undefined
        if (sharedImages.get(url) === entry) sharedImages.delete(url)
        if (controller.signal.aborted) return url
        throw error
      }),
  }
  sharedImages.set(url, entry)
  return entry
}

const releaseEntry = (url: string, entry: RemoteImageEntry) => {
  entry.users -= 1
  if (entry.users !== 0) return
  if (sharedImages.get(url) === entry) sharedImages.delete(url)
  entry.controller?.abort()
  entry.controller = undefined
  if (entry.objectUrl) {
    URL.revokeObjectURL(entry.objectUrl)
    entry.objectUrl = undefined
  }
}

/** Own resolved URLs for an editor's lifetime, including virtualized images. */
export const createRemoteImageResources = (): RemoteImageResources => {
  const ownedImages = new Map<string, RemoteImageEntry>()
  let holds = 1
  let ownerReleased = false

  const release = () => {
    holds -= 1
    if (holds !== 0) return
    ownedImages.forEach((entry, url) => releaseEntry(url, entry))
    ownedImages.clear()
  }

  return {
    async resolve(url) {
      if (holds === 0) return url
      let entry = ownedImages.get(url)
      if (!entry) {
        entry = sharedImages.get(url) ?? createEntry(url)
        entry.users += 1
        ownedImages.set(url, entry)
      }

      try {
        const objectUrl = await entry.promise
        return holds === 0 ? url : objectUrl
      } catch (error) {
        // A failed request is retryable without retaining an entry per failure.
        if (ownedImages.get(url) === entry) {
          ownedImages.delete(url)
          releaseEntry(url, entry)
        }
        throw error
      }
    },
    retain() {
      if (holds === 0) return () => {}
      holds += 1
      let released = false
      return () => {
        if (released) return
        released = true
        release()
      }
    },
    dispose() {
      if (ownerReleased) return
      ownerReleased = true
      release()
    },
  }
}
