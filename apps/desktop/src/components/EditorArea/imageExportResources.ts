import { getExportableImageSrc } from '@/helper/image'

const IMAGE_EXPORT_TIMEOUT_MS = 15_000

async function waitForImageLoad(img: HTMLImageElement, src: string) {
  await new Promise<void>((resolve, reject) => {
    let settled = false
    let decoding = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      img.removeEventListener('load', handleLoad)
      img.removeEventListener('error', handleError)
      if (error) reject(error)
      else resolve()
    }
    const handleError = () => finish(new Error('An image failed to load for JPG export.'))
    const handleLoad = async () => {
      if (settled || decoding) return
      if (img.naturalWidth <= 0 || img.naturalHeight <= 0) {
        handleError()
        return
      }
      decoding = true
      try {
        await img.decode?.()
      } catch {
        // WebKit can reject decode() after a successful load. A missing or
        // broken image must still fail instead of producing a blank export.
        if (!img.complete || img.naturalWidth <= 0) {
          handleError()
          return
        }
      }
      finish()
    }
    const timer = window.setTimeout(
      () => finish(new Error('An image timed out while preparing JPG export.')),
      IMAGE_EXPORT_TIMEOUT_MS,
    )

    img.addEventListener('load', handleLoad, { once: true })
    img.addEventListener('error', handleError, { once: true })
    img.removeAttribute('loading')
    img.src = src
    if (img.complete && img.naturalWidth > 0) void handleLoad()
  })
}

const CSS_IMAGE_URL_REG = /url\(\s*(['"]?)(.*?)\1\s*\)/g
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const isCanvasSafeImageSrc = (src: string) => /^data:image\/(?:png|jpe?g|gif|webp|bmp);/i.test(src)

async function getCanvasSafeImageSrc(src: string, fileFolderPath?: string, renderedSrc?: string) {
  const exportSrc = await getExportableImageSrc(src, fileFolderPath, renderedSrc)
  if (isCanvasSafeImageSrc(exportSrc)) return exportSrc
  if (!/^data:image\/svg\+xml[;,]/i.test(exportSrc) && !exportSrc.startsWith('blob:')) {
    throw new Error('An image could not be embedded for JPG export.')
  }

  // html2canvas gates SVG drawing on browser support and may silently omit an
  // unsupported image. Decode and rasterize explicitly so failures reach the
  // export error handler. Keep intrinsic dimensions to preserve image layout.
  const image = document.createElement('img')
  const canvas = document.createElement('canvas')
  image.crossOrigin = 'anonymous'
  try {
    await waitForImageLoad(image, exportSrc)
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('The image canvas is unavailable for JPG export.')
    context.drawImage(image, 0, 0)
    const raster = canvas.toDataURL('image/png')
    if (!isCanvasSafeImageSrc(raster)) {
      throw new Error('An image could not be rasterized for JPG export.')
    }
    return raster
  } finally {
    image.removeAttribute('src')
    canvas.width = 0
    canvas.height = 0
  }
}

function isSameDocumentFragment(source: string, doc: Document): boolean {
  if (source.startsWith('#')) return true
  try {
    const resource = new URL(source, doc.baseURI)
    if (!resource.hash) return false
    const currentDocument = new URL(doc.URL)
    resource.hash = ''
    currentDocument.hash = ''
    return resource.href === currentDocument.href
  } catch {
    return false
  }
}

async function replaceCssImageUrls(
  value: string,
  fileFolderPath: string | undefined,
  doc: Document,
) {
  const matches = Array.from(value.matchAll(CSS_IMAGE_URL_REG))
  if (!matches.length) {
    return value
  }

  let nextValue = ''
  let lastIndex = 0

  for (const match of matches) {
    const matchIndex = match.index ?? 0
    const matchedText = match[0]
    const rawUrl = match[2].trim()
    nextValue += value.slice(lastIndex, matchIndex)
    if (isSameDocumentFragment(rawUrl, doc)) {
      // SVG masks and other fragment references point into this document;
      // they are not independent image files and must keep their target.
      nextValue += matchedText
    } else {
      const exportSrc = await getCanvasSafeImageSrc(rawUrl, fileFolderPath)
      nextValue += `url("${exportSrc.replace(/"/g, '\\"')}")`
    }
    lastIndex = matchIndex + matchedText.length
  }

  nextValue += value.slice(lastIndex)
  return nextValue
}

async function prepareAll(tasks: Promise<void>[]) {
  // Let every task finish before rollback, so late image resolutions cannot
  // overwrite sources restored by a sibling task's failure.
  const results = await Promise.allSettled(tasks)
  const failure = results.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
}

async function prepareImagesForExport(
  root: HTMLElement,
  fileFolderPath: string | undefined,
  restoreFns: (() => void)[],
) {
  const images = Array.from(root.querySelectorAll('img'))

  await prepareAll(
    images.map(async (img) => {
      const originalSrc =
        img.getAttribute('data-rme-original-src') || img.getAttribute('src') || img.currentSrc || ''
      const renderedSrc = img.currentSrc || img.src
      const exportSrc = await getCanvasSafeImageSrc(originalSrc, fileFolderPath, renderedSrc)

      if (exportSrc === renderedSrc) {
        return
      }

      const previousSrc = img.getAttribute('src')
      const previousSrcset = img.getAttribute('srcset')
      const previousLoading = img.getAttribute('loading')

      restoreFns.push(() => {
        if (previousSrc === null) {
          img.removeAttribute('src')
        } else {
          img.setAttribute('src', previousSrc)
        }

        if (previousSrcset === null) {
          img.removeAttribute('srcset')
        } else {
          img.setAttribute('srcset', previousSrcset)
        }
        if (previousLoading === null) img.removeAttribute('loading')
        else img.setAttribute('loading', previousLoading)
      })

      img.removeAttribute('srcset')
      await waitForImageLoad(img, exportSrc)
    }),
  )
}

async function prepareCssImagesForExport(
  root: HTMLElement,
  fileFolderPath: string | undefined,
  restoreFns: (() => void)[],
) {
  const cssImageProperties = [
    'background-image',
    'border-image-source',
    'list-style-image',
    'mask-image',
    '-webkit-mask-image',
  ]
  const elements = [root, ...Array.from(root.querySelectorAll('*'))]

  for (const element of elements) {
    if (!('style' in element)) {
      continue
    }

    const style = (element as HTMLElement | SVGElement).style
    const computedStyle = window.getComputedStyle(element)

    for (const property of cssImageProperties) {
      const value = computedStyle.getPropertyValue(property)
      if (!value || value === 'none' || !value.includes('url(')) {
        continue
      }

      const nextValue = await replaceCssImageUrls(value, fileFolderPath, element.ownerDocument)
      if (nextValue === value) {
        continue
      }

      const previousValue = style.getPropertyValue(property)
      const previousPriority = style.getPropertyPriority(property)
      restoreFns.push(() => {
        if (previousValue) {
          style.setProperty(property, previousValue, previousPriority)
        } else {
          style.removeProperty(property)
        }
      })
      style.setProperty(property, nextValue)
    }
  }
}

async function prepareSvgImagesForExport(
  root: HTMLElement,
  fileFolderPath: string | undefined,
  restoreFns: (() => void)[],
) {
  const svgImages = Array.from(root.querySelectorAll('svg image'))

  await prepareAll(
    svgImages.map(async (image) => {
      const previousHref = image.getAttribute('href')
      const previousXlinkHref = image.getAttributeNS(XLINK_NS, 'href')
      const href = previousHref || previousXlinkHref || ''
      if (!href) {
        return
      }

      const exportSrc = await getCanvasSafeImageSrc(href, fileFolderPath)

      restoreFns.push(() => {
        if (previousHref === null) {
          image.removeAttribute('href')
        } else {
          image.setAttribute('href', previousHref)
        }

        if (previousXlinkHref === null) {
          image.removeAttributeNS(XLINK_NS, 'href')
        } else {
          image.setAttributeNS(XLINK_NS, 'href', previousXlinkHref)
        }
      })

      image.setAttribute('href', exportSrc)
      image.setAttributeNS(XLINK_NS, 'href', exportSrc)
    }),
  )
}

function prepareEmbeddedMediaForExport(root: HTMLElement) {
  const restoreFns: (() => void)[] = []
  const canvases = Array.from(root.querySelectorAll('canvas')) as HTMLCanvasElement[]
  const embeddedFrames = Array.from(root.querySelectorAll('iframe, video'))

  const hideElement = (element: HTMLElement) => {
    const previousVisibility = element.style.visibility
    restoreFns.push(() => {
      element.style.visibility = previousVisibility
    })
    element.style.visibility = 'hidden'
  }

  canvases.forEach((canvas) => {
    try {
      canvas.toDataURL('image/png')
    } catch (error) {
      hideElement(canvas)
    }
  })

  embeddedFrames.forEach((element) => {
    hideElement(element as HTMLElement)
  })

  return () => {
    restoreFns.reverse().forEach((restore) => restore())
  }
}

export async function prepareResourcesForExport(root: HTMLElement, fileFolderPath?: string) {
  const restoreFns = [prepareEmbeddedMediaForExport(root)]
  const restore = () => {
    restoreFns
      .splice(0)
      .reverse()
      .forEach((restoreResource) => restoreResource())
  }
  try {
    await prepareImagesForExport(root, fileFolderPath, restoreFns)
    await prepareSvgImagesForExport(root, fileFolderPath, restoreFns)
    await prepareCssImagesForExport(root, fileFolderPath, restoreFns)
    return restore
  } catch (error) {
    restore()
    throw error
  }
}
