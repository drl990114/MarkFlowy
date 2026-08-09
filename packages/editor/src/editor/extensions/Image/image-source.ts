import { applyImageRequestPolicy } from '../../utils/image-loading'

export { IMAGE_REFERRER_POLICY } from '../../utils/image-loading'

const GOOGLE_DRIVE_HOSTS = new Set(['drive.google.com', 'www.drive.google.com'])

export function normalizeImageSourceForBrowser(source: string): string {
  try {
    const url = new URL(source)
    if (!GOOGLE_DRIVE_HOSTS.has(url.hostname) || url.pathname !== '/uc') {
      return source
    }

    const fileId = url.searchParams.get('id')
    if (!fileId) return source

    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(fileId)}`
  } catch {
    return source
  }
}

export function preloadImageSource(
  source: string,
  createImage: () => HTMLImageElement = () => new Image(),
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = createImage()
    image.onload = () => resolve(source)
    image.onerror = () => reject(new Error('Failed to load image source'))
    applyImageRequestPolicy(image)
    image.src = source
  })
}
