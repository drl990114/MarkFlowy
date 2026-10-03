import { createRoot } from 'react-dom/client'
import { PreviewSurface } from './PreviewSurface'
import {
  PREVIEW_CHANNEL,
  isPreviewMessage,
  matchesPreviewOrigin,
  previewTargetOrigin,
} from './protocol'
import '@/ui.css'
import './preview.css'

const session = new URLSearchParams(window.location.search).get('session')
const url = new URL(window.location.href)
const container = document.getElementById('root')
if (session && container && window.parent !== window) {
  const root = createRoot(container)
  let port: MessagePort | undefined
  const ready = () =>
    window.parent.postMessage(
      { channel: PREVIEW_CHANNEL, session, type: 'ready' },
      previewTargetOrigin(url),
    )
  window.addEventListener('message', (event) => {
    if (
      event.source !== window.parent ||
      !matchesPreviewOrigin(event.origin, url) ||
      !isPreviewMessage(event.data, session)
    )
      return
    if (event.data.type === 'hello') ready()
    if (event.data.type !== 'connect' || !event.ports[0]) return
    port?.close()
    port = event.ports[0]
    port.onmessage = (message) => {
      if (!isPreviewMessage(message.data, session) || message.data.type !== 'update') return
      root.render(
        <PreviewSurface
          {...message.data.state}
          onInspect={(token) => {
            port?.postMessage({ channel: PREVIEW_CHANNEL, session, type: 'inspect', token })
          }}
        />,
      )
    }
    port.start()
    port.postMessage({ channel: PREVIEW_CHANNEL, session, type: 'ready' })
  })
  // The sample document is interactive, but links must never navigate the preview.
  const preventNavigation = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('a[href]')) {
      event.preventDefault()
    }
  }
  document.addEventListener('click', preventNavigation, true)
  document.addEventListener('auxclick', preventNavigation, true)
  document.addEventListener('submit', (event) => event.preventDefault(), true)
  window.addEventListener('pagehide', () => {
    port?.close()
  })
  ready()
}
