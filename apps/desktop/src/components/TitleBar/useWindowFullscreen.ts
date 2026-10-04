import { currentWindow } from '@/services/windows'
import type { UnlistenFn } from '@tauri-apps/api/event'
import { useEffect, useState } from 'react'

export function useWindowFullscreen(enabled: boolean) {
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let active = true
    let requestId = 0
    let unlisten: UnlistenFn | undefined

    const syncFullscreen = async () => {
      if (!active) return
      const currentRequest = ++requestId

      try {
        const nextFullscreen = await currentWindow.isFullscreen()
        if (active && currentRequest === requestId) setFullscreen(nextFullscreen)
      } catch {
        // Keep the last known state when native APIs are unavailable.
      }
    }

    const subscribe = async () => {
      try {
        // macOS emits a resize after completing each native fullscreen transition.
        const dispose = await currentWindow.onResized(() => void syncFullscreen())
        if (!active) {
          dispose()
          return
        }
        unlisten = dispose
      } catch {
        // Browser-only previews have no native window event source.
      }

      // Subscribe first so a transition during setup cannot leave a stale snapshot.
      await syncFullscreen()
    }

    void subscribe()
    return () => {
      active = false
      unlisten?.()
    }
  }, [enabled])

  return enabled && fullscreen
}
