import { posix } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { prepareResourcesForExport } from './imageExportResources'

const native = vi.hoisted(() => ({ invoke: vi.fn(), fetch: vi.fn() }))
vi.mock('@/stores', () => ({ useEditorStore: { getState: () => ({ folderData: null }) } }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: native.invoke, convertFileSrc: vi.fn() }))
vi.mock('@tauri-apps/api/path', () => ({ join: (...parts: string[]) => posix.join(...parts) }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: native.fetch }))
vi.mock('@/helper/filesys', () => ({ FileResultCode: { Success: 0 } }))
vi.mock('@/helper/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

const svgData = `data:image/svg+xml;base64,${btoa(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120"><circle cx="60" cy="60" r="35" fill="blue"/></svg>',
)}`
const rasterData = 'data:image/png;base64,cmFzdGVyaXplZC1zdmctcGl4ZWxz'
const pngData = 'data:image/png;base64,ZXhpc3RpbmctcG5n'

describe('JPG image preparation', () => {
  let drawImage: ReturnType<typeof vi.fn>
  let decode: MockInstance<HTMLImageElement['decode']>
  let canvasToDataUrl: MockInstance<HTMLCanvasElement['toDataURL']>
  let imageEvent: 'load' | 'error'

  beforeEach(() => {
    vi.clearAllMocks()
    imageEvent = 'load'
    native.invoke.mockImplementation(async (command: string, args: { filePath: string }) => {
      if (command === 'file_exists') return true
      if (command === 'read_u8_array_from_file') {
        return {
          code: 0,
          content: args.filePath.endsWith('.svg') ? svgData.split(',')[1] : pngData.split(',')[1],
        }
      }
      throw new Error(`Unexpected native command: ${command}`)
    })
    vi.spyOn(HTMLImageElement.prototype, 'src', 'set').mockImplementation(function (
      this: HTMLImageElement,
      value,
    ) {
      this.setAttribute('src', value)
      queueMicrotask(() => this.dispatchEvent(new Event(imageEvent)))
    })
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(false)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(() =>
      imageEvent === 'error' ? 0 : 360,
    )
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockImplementation(() =>
      imageEvent === 'error' ? 0 : 120,
    )
    decode = vi.spyOn(HTMLImageElement.prototype, 'decode').mockResolvedValue()
    drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D)
    canvasToDataUrl = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(rasterData)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    document.body.replaceChildren()
  })

  it.each([
    './assets/diagram.svg',
    'asset://localhost/%2Fworkspace%2Fassets%2Fdiagram.svg',
    'http://asset.localhost/%2Fworkspace%2Fassets%2Fdiagram.svg',
    'https://asset.localhost/%2Fworkspace%2Fassets%2Fdiagram.svg',
  ])('draws the native SVG resolved from %s before export and restores its source', async (source) => {
    const root = document.createElement('div')
    const image = document.createElement('img')
    image.setAttribute('src', source)
    image.setAttribute('srcset', 'original@2x.svg 2x')
    image.setAttribute('loading', 'lazy')
    root.append(image)
    let drawnSource: string | undefined
    let drawnSize: number[] | undefined
    drawImage.mockImplementation((decodedImage: HTMLImageElement) => {
      drawnSource = decodedImage.src
    })
    canvasToDataUrl.mockImplementation(function (this: HTMLCanvasElement) {
      drawnSize = [this.width, this.height]
      expect(drawImage).toHaveBeenCalledOnce()
      return rasterData
    })

    const restore = await prepareResourcesForExport(root, '/workspace')

    expect(native.invoke).toHaveBeenCalledWith('read_u8_array_from_file', {
      filePath: '/workspace/assets/diagram.svg',
    })
    expect(native.fetch).not.toHaveBeenCalled()
    expect(drawnSource).toBe(svgData)
    expect(drawnSize).toEqual([360, 120])
    expect(image.src).toBe(rasterData)
    expect(image.hasAttribute('srcset')).toBe(false)
    expect(decode).toHaveBeenCalledTimes(2)
    const temporaryImage = drawImage.mock.calls[0][0] as HTMLImageElement
    const temporaryCanvas = canvasToDataUrl.mock.contexts[0] as HTMLCanvasElement
    expect(temporaryImage.hasAttribute('src')).toBe(false)
    expect([temporaryCanvas.width, temporaryCanvas.height]).toEqual([0, 0])

    restore()
    restore()
    expect(image.getAttribute('src')).toBe(source)
    expect(image.getAttribute('srcset')).toBe('original@2x.svg 2x')
    expect(image.getAttribute('loading')).toBe('lazy')
  })

  it('waits for SVG decoding before rasterization and export readiness', async () => {
    let finishDecode!: () => void
    decode.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishDecode = resolve
      }),
    )
    const root = document.createElement('div')
    root.innerHTML = `<img src="${svgData}">`
    const pending = prepareResourcesForExport(root)
    let ready = false
    void pending.then(() => {
      ready = true
    })
    await vi.waitFor(() => expect(decode).toHaveBeenCalledOnce())
    expect(drawImage).not.toHaveBeenCalled()
    expect(ready).toBe(false)

    finishDecode()
    const restore = await pending
    expect(drawImage).toHaveBeenCalledOnce()
    expect(root.querySelector('img')?.src).toBe(rasterData)
    restore()
  })

  it('rasterizes an owned Blob source without revoking its caller-owned URL', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL')
    const root = document.createElement('div')
    root.innerHTML = '<img src="blob:owned-svg">'
    const restore = await prepareResourcesForExport(root)
    expect(drawImage).toHaveBeenCalledOnce()
    expect(root.querySelector('img')?.src).toBe(rasterData)
    restore()
    expect(revoke).not.toHaveBeenCalled()
  })

  it('fails and rolls back completed sibling images when SVG rasterization is tainted', async () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<img src="./photo.png" srcset="photo@2x.png 2x" loading="lazy"><img src="./bad.svg"><iframe style="visibility:visible"></iframe>'
    canvasToDataUrl.mockImplementation(() => {
      throw new DOMException('Tainted canvas', 'SecurityError')
    })

    await expect(prepareResourcesForExport(root, '/workspace')).rejects.toThrow('Tainted canvas')
    expect(root.querySelectorAll('img')[0].outerHTML).toBe(
      '<img src="./photo.png" srcset="photo@2x.png 2x" loading="lazy">',
    )
    expect(root.querySelectorAll('img')[1].getAttribute('src')).toBe('./bad.svg')
    expect(root.querySelector('iframe')?.style.visibility).toBe('visible')
    expect(drawImage).toHaveBeenCalledOnce()
    expect(canvasToDataUrl).toHaveBeenCalledOnce()
    const temporaryImage = drawImage.mock.calls[0][0] as HTMLImageElement
    expect(temporaryImage.hasAttribute('src')).toBe(false)
  })

  it('reports a failed SVG load instead of substituting a transparent image', async () => {
    imageEvent = 'error'
    const root = document.createElement('div')
    root.innerHTML = '<img src="./broken.svg">'
    await expect(prepareResourcesForExport(root, '/workspace')).rejects.toThrow('failed to load')
    expect(root.querySelector('img')?.getAttribute('src')).toBe('./broken.svg')
    expect(drawImage).not.toHaveBeenCalled()
    expect(canvasToDataUrl).not.toHaveBeenCalled()
  })

  it('bounds a stalled decode and removes its temporary resources', async () => {
    vi.useFakeTimers()
    decode.mockImplementation(() => new Promise(() => {}))
    const root = document.createElement('div')
    root.innerHTML = `<img src="${svgData}">`
    const pending = prepareResourcesForExport(root)
    const rejected = expect(pending).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(15_000)
    await rejected
    expect(drawImage).not.toHaveBeenCalled()
    expect((decode.mock.contexts[0] as HTMLImageElement).hasAttribute('src')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not erase unreadable native images', async () => {
    native.invoke.mockResolvedValue({ code: 1, content: 'File is unavailable' })
    const root = document.createElement('div')
    root.innerHTML = '<img src="asset://localhost/%2Fmissing.svg">'
    await expect(prepareResourcesForExport(root)).rejects.toThrow('could not be embedded')
    expect(root.querySelector('img')?.getAttribute('src')).toBe('asset://localhost/%2Fmissing.svg')
    expect(canvasToDataUrl).not.toHaveBeenCalled()
  })

  it('prepares CSS and nested SVG image references and restores both attributes and styles', async () => {
    const root = document.createElement('div')
    root.innerHTML =
      '<svg><image href="./diagram.svg"/></svg><div style="background-image:url(./diagram.svg)"></div>'
    document.body.append(root)
    const originalBackground = root.querySelector('div')?.style.backgroundImage
    const restore = await prepareResourcesForExport(root, '/workspace')
    expect(root.querySelector('image')?.getAttribute('href')).toBe(rasterData)
    expect(root.querySelector('div')?.style.backgroundImage).toContain(rasterData)
    expect(drawImage).toHaveBeenCalledTimes(2)
    restore()
    expect(root.querySelector('image')?.getAttribute('href')).toBe('./diagram.svg')
    expect(
      root.querySelector('image')?.hasAttributeNS('http://www.w3.org/1999/xlink', 'href'),
    ).toBe(false)
    expect(root.querySelector('div')?.style.backgroundImage).toBe(originalBackground)
  })

  it('preserves same-document CSS fragments while embedding separate background images', async () => {
    const root = document.createElement('div')
    const absoluteFragment = new URL('#mask', document.URL).href
    root.innerHTML = `<svg><defs><mask id="mask"></mask><pattern id="pattern"></pattern></defs></svg>
      <div style="mask-image:url(#mask);background-image:url(#pattern),url(./diagram.svg)"></div>
      <span style="background-image:url('${absoluteFragment}')"></span>`
    document.body.append(root)
    const target = root.querySelector('div')!
    const absoluteTarget = root.querySelector('span')!
    const originalMask = target.style.getPropertyValue('mask-image')
    const originalBackground = target.style.backgroundImage
    const originalAbsoluteBackground = absoluteTarget.style.backgroundImage

    const restore = await prepareResourcesForExport(root, '/workspace')

    expect(target.style.getPropertyValue('mask-image')).toBe(originalMask)
    expect(target.style.backgroundImage).toContain('#pattern')
    expect(target.style.backgroundImage).toContain(rasterData)
    expect(absoluteTarget.style.backgroundImage).toBe(originalAbsoluteBackground)
    expect(native.invoke.mock.calls.every(([, args]) => !args.filePath.includes('#'))).toBe(true)
    expect(native.fetch).not.toHaveBeenCalled()
    expect(drawImage).toHaveBeenCalledOnce()
    restore()
    expect(target.style.backgroundImage).toBe(originalBackground)
  })
})
