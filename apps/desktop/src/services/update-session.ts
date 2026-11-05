import { invoke } from '@tauri-apps/api/core'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getAllWindows } from '@tauri-apps/api/window'

const REQUEST = 'mf-update-session-request'
const RESPONSE = 'mf-update-session-response'
type Request = { id: string; replyTo: string }
type Response = { id: string; label: string; error?: string }

export function listenForUpdateSession(label: string, flush: () => Promise<void>) {
  return listen<Request>(REQUEST, async ({ payload }) => {
    let error: string | undefined
    try { await flush() } catch (cause) { error = String(cause) }
    await emitTo(payload.replyTo, RESPONSE, { id: payload.id, label, error })
  })
}

export async function preserveUpdateSession(replyTo: string) {
  const labels = (await getAllWindows()).map((window) => window.label)
    .filter((label) => label === 'main' || label.startsWith('main_'))
  const pending = new Set(labels)
  const id = crypto.randomUUID()
  let timeout: ReturnType<typeof setTimeout> | undefined
  let stop: (() => void) | undefined
  let finished = false
  try {
    await new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Timed out preserving update session')), 30000)
      void listen<Response>(RESPONSE, ({ payload }) => {
        if (payload.id !== id || !pending.has(payload.label)) return
        if (payload.error) { reject(new Error(payload.error)); return }
        pending.delete(payload.label)
        if (!pending.size) resolve()
      }).then(async (unlisten) => {
        if (finished) { unlisten(); return }
        stop = unlisten
        if (!pending.size) { resolve(); return }
        await Promise.all(labels.map((label) => emitTo(label, REQUEST, { id, replyTo })))
      }).catch(reject)
    })
    await invoke('preserve_update_session', { labels })
  } finally {
    finished = true
    clearTimeout(timeout)
    stop?.()
  }
}
