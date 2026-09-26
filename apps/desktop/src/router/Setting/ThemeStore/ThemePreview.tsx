import { useCallback, useEffect, useRef, useState } from 'react'
import { themeTokens, type ResolvedTheme, type ThemeTokenName } from '@markflowy/theme/semantic'
import {
  PREVIEW_CHANNEL,
  isPreviewMessage,
  matchesPreviewOrigin,
  previewTargetOrigin,
  type ThemePreviewState,
} from '@/themes/preview/protocol'
import { useThemeLabels } from './labels'

export function ThemePreview({
  theme,
  snippets,
  inspect,
  onInspect,
}: {
  theme: ResolvedTheme
  snippets: readonly { id: string; css: string }[]
  inspect: boolean
  onInspect: (name: ThemeTokenName) => void
}) {
  const labels = useThemeLabels()
  const frame = useRef<HTMLIFrameElement>(null)
  const port = useRef<MessagePort | null>(null)
  const [session] = useState(() => crypto.randomUUID())
  const [src] = useState(() => {
    const base = new URL(import.meta.env.BASE_URL, window.location.href)
    const url = new URL('theme-preview.html', base)
    url.searchParams.set('session', session)
    return url.href
  })
  const latest = useRef({ theme, snippets, inspect, labels, onInspect })
  latest.current = { theme, snippets, inspect, labels, onInspect }
  const sendState = useCallback(() => {
    const current = latest.current
    const state: ThemePreviewState = {
      theme: current.theme,
      snippets: current.snippets,
      inspect: current.inspect,
      labels: {
        preview: current.labels.preview,
        loadError: current.labels.loadError,
        error: current.labels.error,
        retry: current.labels.retry,
      },
    }
    port.current?.postMessage({ channel: PREVIEW_CHANNEL, session, type: 'update', state })
  }, [session])
  useEffect(() => {
    const url = new URL(src)
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        !matchesPreviewOrigin(event.origin, url) ||
        !isPreviewMessage(event.data, session) ||
        event.data.type !== 'ready'
      )
        return
      // Verify the expected document before transferring a channel. Theme data only
      // travels over this document-bound port, never to a navigated window.
      try {
        if (frame.current.contentWindow?.location.href !== src) return
      } catch {
        return
      }
      port.current?.close()
      const channel = new MessageChannel()
      port.current = channel.port1
      channel.port1.onmessage = (message) => {
        if (!isPreviewMessage(message.data, session)) return
        if (message.data.type === 'ready') sendState()
        if (message.data.type === 'inspect' && Object.hasOwn(themeTokens, message.data.token))
          latest.current.onInspect(message.data.token)
      }
      channel.port1.start()
      frame.current.contentWindow?.postMessage(
        { channel: PREVIEW_CHANNEL, session, type: 'connect' },
        previewTargetOrigin(url),
        [channel.port2],
      )
    }
    window.addEventListener('message', receive)
    return () => {
      window.removeEventListener('message', receive)
      port.current?.close()
      port.current = null
    }
  }, [session, src, sendState])
  useEffect(() => {
    sendState()
  }, [theme, snippets, inspect, labels, sendState])
  return (
    <iframe
      ref={frame}
      title={labels.preview}
      className='h-full min-h-[480px] w-full rounded-md border border-border bg-background'
      src={src}
      sandbox='allow-scripts allow-same-origin'
      onLoad={() => {
        port.current?.close()
        port.current = null
        frame.current?.contentWindow?.postMessage(
          { channel: PREVIEW_CHANNEL, session, type: 'hello' },
          previewTargetOrigin(new URL(src)),
        )
      }}
    />
  )
}
