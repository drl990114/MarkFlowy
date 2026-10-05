import { diff } from '@codemirror/merge'

self.onmessage = ({ data }: MessageEvent<{ before: string; after: string }>) => {
  try {
    const changes = diff(data.before, data.after, { scanLimit: 2000, timeout: 1000 })
    self.postMessage({ changes })
  } catch (error) {
    self.postMessage({ error: String(error) })
  }
}
