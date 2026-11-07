import { watch } from '@tauri-apps/plugin-fs'

/** Watch the directory so editors that save by replacing a file stay observable. */
export async function watchSnippetDirectory(directory: string, reload: () => Promise<void>) {
  let stopped = false
  let running = false
  let queued = false
  const refresh = async () => {
    if (stopped) return
    if (running) {
      queued = true
      return
    }
    running = true
    try {
      do {
        queued = false
        // reload records failures in the library; the next event/focus can retry.
        await reload().catch(() => undefined)
      } while (queued && !stopped)
    } finally {
      running = false
    }
  }
  const unwatch = await watch(
    directory,
    (event) => {
      if (typeof event.type === 'object' && 'access' in event.type) return
      void refresh()
    },
    { delayMs: 400, recursive: false },
  )
  const onFocus = () => void refresh()
  window.addEventListener('focus', onFocus)
  // Reconcile anything written between the initial scan and watcher registration.
  await refresh()
  return () => {
    stopped = true
    window.removeEventListener('focus', onFocus)
    unwatch()
  }
}
