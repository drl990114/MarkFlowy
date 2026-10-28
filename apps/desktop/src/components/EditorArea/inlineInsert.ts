/** Match markdown-it's readable URLs without decoding delimiters or literal percent escapes. */
export function formatInlineAddress(value: string): string {
  if (/^(?:data|blob):/i.test(value) || !value.includes('%')) return value
  try {
    return decodeURI(value.replace(/%25/gi, '%2525'))
  } catch {
    return value
  }
}

export function normalizeInlineAddress(value: string, kind: 'link' | 'image'): string | null {
  const address = value.trim()
  if (!address || /[\u0000-\u001f\u007f]/.test(address)) return null
  if (/^(javascript|vbscript):/i.test(address)) return null
  if (/^data:/i.test(address)) {
    // Match MIME metadata here; the runtime image commands validate the payload,
    // including recognizing a supported raster signature for octet-stream URLs.
    const comma = address.indexOf(',')
    const metadata = comma > 0 && comma <= 1024 ? address.slice(0, comma) : ''
    return kind === 'image' &&
      /^data:(?:image\/(?:avif|gif|jpe?g|png|webp)|application\/octet-stream)(?:;[\w!#$%&'*+.^`|~-]+=[\w!#$%&'*+.^`|~-]+)*;base64$/i.test(metadata)
      ? address
      : null
  }
  if (/^https?:/i.test(address)) {
    try {
      return new URL(address).hostname ? address : null
    } catch {
      return null
    }
  }
  return address
}

export async function chooseInlineImage(): Promise<string | null> {
  const [{ open }, { invoke }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/api/core'),
  ])
  const path = await open({
    multiple: false,
    filters: [{ name: 'Images', extensions: ['avif', 'gif', 'jpeg', 'jpg', 'png', 'svg', 'webp'] }],
    fileAccessMode: 'scoped',
  })
  if (typeof path !== 'string') return null
  await invoke<boolean>('save_security_bookmark', { path })
  return path
}
