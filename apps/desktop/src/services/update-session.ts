import { invoke } from '@tauri-apps/api/core'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getAllWindows } from '@tauri-apps/api/window'
import { flushSync } from 'react-dom'
import {
  FILE_MUTATION_QUEUE_KEY,
  savePathCoordinator,
} from '@/components/EditorArea/savePathCoordinator'
import useEditorStore from '@/stores/useEditorStore'

const REQUEST = 'mf-update-session-request'
const RESPONSE = 'mf-update-session-response'
const RELEASE = 'mf-update-session-release'
const HEARTBEAT = 'mf-update-session-heartbeat'
const TIMEOUT_MS = 30_000
const HEARTBEAT_MS = 5_000
type Request = { id: string; replyTo: string; expiresAt: number }
type Response = { id: string; label: string; error?: string }
type Release = Pick<Request, 'id' | 'expiresAt'>

export interface UpdateSessionPersistence {
  prepare: () => Promise<void>
  flush: () => Promise<void>
}

/** Keep the existing edit/Save As barrier until every window is ready and the updater finishes. */
export async function listenForUpdateSession(label: string, persistence: UpdateSessionPersistence) {
  let disposed = false
  let active: { id: string; release: () => void; renew: () => void } | undefined
  const cancelled = new Map<string, number>()
  const stops: (() => void)[] = []
  const cancel = ({ id, expiresAt }: Release) => {
    // An abort can arrive while the request is still being delivered or waiting for startup.
    cancelled.set(id, expiresAt)
    for (const [key, deadline] of cancelled) if (deadline < Date.now()) cancelled.delete(key)
    if (active?.id === id) active.release()
  }
  const dispose = () => {
    disposed = true
    active?.release()
    stops.forEach((stop) => stop())
  }
  try {
    stops.push(await listen<Release>(RELEASE, ({ payload }) => cancel(payload)))
    stops.push(await listen<{ id: string }>(HEARTBEAT, ({ payload }) => {
      if (active?.id === payload.id) active.renew()
    }))
    stops.push(await listen<Request>(REQUEST, async ({ payload }) => {
      if (disposed || cancelled.has(payload.id) || payload.expiresAt < Date.now()) return
      if (active) {
        await emitTo(payload.replyTo, RESPONSE, {
          id: payload.id, label, error: 'Another update is already preserving this window',
        })
        return
      }
      let released = false
      let finish!: () => void
      let watchdog: ReturnType<typeof setTimeout> | undefined
      const releaseSignal = new Promise<void>((resolve) => { finish = resolve })
      const release = () => {
        released = true
        clearTimeout(watchdog)
        finish()
      }
      const renew = () => {
        if (released) return
        clearTimeout(watchdog)
        // A closed/crashed requester cannot leave another editor permanently read-only.
        watchdog = setTimeout(release, TIMEOUT_MS)
      }
      const request = { id: payload.id, release, renew }
      active = request
      renew()
      try {
        // Startup/workspace switches can themselves need the file-mutation queue.
        await Promise.race([persistence.prepare(), releaseSignal])
        if (released) return
        await savePathCoordinator.runExclusive(
          FILE_MUTATION_QUEUE_KEY,
          `update-session:${payload.id}`,
          async (lease) => {
            if (released) return
            // Publish deferred editor input before the read-only projection is applied.
            const editor = useEditorStore.getState()
            for (const id of editor.opened) editor.getEditorContent(id)
            flushSync(() => {
              lease.activate('update-session')
              lease.enableOtherEditorBarrier()
            })
            await Promise.race([persistence.flush(), releaseSignal])
            if (released) return
            await Promise.race([
              emitTo(payload.replyTo, RESPONSE, { id: payload.id, label }),
              releaseSignal,
            ])
            await releaseSignal
          },
        )
      } catch (error) {
        if (!released) {
          // A broken event channel must still release this renderer's local barrier.
          await emitTo(payload.replyTo, RESPONSE, { id: payload.id, label, error: String(error) })
            .catch(() => undefined)
        }
      } finally {
        release()
        if (active === request) active = undefined
      }
    }))
    return dispose
  } catch (error) {
    dispose()
    throw error
  }
}

export async function withPreservedUpdateSession<T>(replyTo: string, operation: () => Promise<T>) {
  const labels = (await getAllWindows()).map((window) => window.label)
    .filter((label) => label === 'main' || label.startsWith('main_'))
  const pending = new Set(labels)
  const id = crypto.randomUUID()
  const expiresAt = Date.now() + TIMEOUT_MS
  let timeout: ReturnType<typeof setTimeout> | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let stop: (() => void) | undefined
  let finished = false
  try {
    await new Promise<void>((resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Timed out preserving update session')), TIMEOUT_MS)
      void listen<Response>(RESPONSE, ({ payload }) => {
        if (payload.id !== id || !pending.has(payload.label)) return
        if (payload.error) { reject(new Error(payload.error)); return }
        pending.delete(payload.label)
        if (!pending.size) resolve()
      }).then(async (unlisten) => {
        if (finished) { unlisten(); return }
        stop = unlisten
        if (!pending.size) { resolve(); return }
        heartbeat = setInterval(() => {
          void Promise.allSettled(labels.map((label) => emitTo(label, HEARTBEAT, { id })))
        }, HEARTBEAT_MS)
        await Promise.all(labels.map((label) => emitTo(label, REQUEST, { id, replyTo, expiresAt })))
      }).catch(reject)
    })
    clearTimeout(timeout)
    await invoke('preserve_update_session', { labels })
    return await operation()
  } finally {
    finished = true
    clearTimeout(timeout)
    clearInterval(heartbeat)
    stop?.()
    await Promise.allSettled(labels.map((label) => emitTo(label, RELEASE, { id, expiresAt })))
  }
}
