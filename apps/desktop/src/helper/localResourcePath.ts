/** Keep Markdown source separate from the path passed to native I/O. */
export function decodeLocalResource(value: string): string {
  try {
    return decodeURIComponent(value.replace(/%(?![0-9a-f]{2})/gi, '%25'))
  } catch {
    return value
  }
}

export function localResourcePath(value: string): string | undefined {
  const target = value.trim()
  if (/^file:/i.test(target)) {
    try {
      const url = new URL(target)
      const path = decodeLocalResource(url.pathname)
      return url.hostname && url.hostname !== 'localhost'
        ? `//${url.hostname}${path}`
        : path.replace(/^\/([a-z]:\/)/i, '$1')
    } catch {
      return undefined
    }
  }
  // Split before decoding: %23 is a filename character, # introduces a fragment.
  return decodeLocalResource(target.split(/[?#]/, 1)[0])
}

export function resourceFragment(value: string): string | undefined {
  const index = value.indexOf('#')
  return index < 0 ? undefined : value.slice(index + 1)
}
