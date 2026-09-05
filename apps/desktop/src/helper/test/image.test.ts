import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  convertFileSrc: vi.fn((path: string) => `asset://localhost/${path}`),
  createObjectURL: vi.fn((blob: Blob) => {
    void blob
    return 'blob:remote-image'
  }),
  fetch: vi.fn(),
  invoke: vi.fn(),
  join: vi.fn(),
  loggerWarn: vi.fn(),
}))

vi.mock('@/stores', () => ({
  useEditorStore: {
    getState: () => ({ folderData: null }),
  },
}))

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: mocks.convertFileSrc,
  invoke: mocks.invoke,
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: mocks.join,
}))

vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: mocks.fetch,
}))

vi.mock('../filesys', () => ({
  FileResultCode: { Success: 0 },
}))

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: mocks.loggerWarn,
  },
}))

import { getImageUrlInTauri } from '../image'

describe('getImageUrlInTauri', () => {
  const originalCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL')

  beforeAll(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: mocks.createObjectURL,
    })
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterAll(() => {
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', originalCreateObjectURL)
    } else {
      delete (URL as unknown as { createObjectURL?: typeof URL.createObjectURL }).createObjectURL
    }
  })

  it('loads redirecting remote images through Tauri HTTP', async () => {
    const source = 'https://i2.kknews.cc/SIG=1of3siu/5qr00060rss39243533.jpg'
    const blob = new Blob(['image'], { type: 'image/jpeg' })
    mocks.fetch.mockResolvedValue({
      blob: vi.fn().mockResolvedValue(blob),
      headers: new Headers({ 'content-type': 'image/jpeg' }),
      ok: true,
    })

    await expect(getImageUrlInTauri(source)).resolves.toBe('blob:remote-image')
    expect(mocks.fetch).toHaveBeenCalledWith(source, {
      maxRedirections: 5,
      method: 'GET',
      mode: 'cors',
    })
    expect(mocks.createObjectURL).toHaveBeenCalledWith(blob)
  })

  it.each(['./图片/中文.png', './%E5%9B%BE%E7%89%87/%E4%B8%AD%E6%96%87.png'])(
    'resolves the local Chinese image path %s before Tauri encodes it',
    async (source) => {
      mocks.join.mockResolvedValue('/workspace/图片/中文.png')
      mocks.invoke.mockResolvedValue(true)
      await expect(getImageUrlInTauri(source, '/workspace')).resolves.toBe(
        'asset://localhost//workspace/图片/中文.png',
      )
      expect(mocks.join).toHaveBeenCalledWith('/workspace', './图片/中文.png')
      expect(mocks.invoke).toHaveBeenCalledWith('file_exists', {
        filePath: '/workspace/图片/中文.png',
      })
      expect(mocks.convertFileSrc).toHaveBeenCalledWith('/workspace/图片/中文.png')
      expect(mocks.fetch).not.toHaveBeenCalled()
    },
  )

  it('passes Base64 images through without native file or network requests', async () => {
    const source =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8L8AAAAASUVORK5CYII='
    await expect(getImageUrlInTauri(source, '/workspace')).resolves.toBe(source)
    expect(mocks.fetch).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(mocks.convertFileSrc).not.toHaveBeenCalled()
  })

  it('loads encoded remote image URLs through Tauri HTTP without changing the source', async () => {
    const source =
      'https://img.shields.io/badge/platforms-macOS%20%7C%20Linux-475569?style=flat-square'
    const blob = new Blob(['image'], { type: 'image/svg+xml' })
    mocks.fetch.mockResolvedValue({
      blob: vi.fn().mockResolvedValue(blob),
      headers: new Headers({ 'content-type': 'image/svg+xml' }),
      ok: true,
    })

    await expect(getImageUrlInTauri(source)).resolves.toBe('blob:remote-image')
    expect(mocks.fetch).toHaveBeenCalledWith(source, {
      maxRedirections: 5,
      method: 'GET',
      mode: 'cors',
    })
    expect(mocks.createObjectURL).toHaveBeenCalledWith(blob)

    await expect(getImageUrlInTauri(source)).resolves.toBe('blob:remote-image')
    expect(mocks.fetch).toHaveBeenCalledOnce()
  })

  it('restores an SVG MIME type omitted by the Tauri response Blob', async () => {
    const source = 'https://img.shields.io/badge/build-passing-brightgreen.svg'
    const untypedBlob = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'])
    mocks.fetch.mockResolvedValue({
      blob: vi.fn().mockResolvedValue(untypedBlob),
      headers: new Headers({ 'content-type': 'image/svg+xml;charset=utf-8' }),
      ok: true,
    })

    await expect(getImageUrlInTauri(source)).resolves.toBe('blob:remote-image')

    const renderedBlob = mocks.createObjectURL.mock.calls[0]?.[0]
    expect(renderedBlob).not.toBe(untypedBlob)
    expect(renderedBlob?.type).toBe('image/svg+xml')
  })

  it('normalizes protocol-relative URLs before loading them through Tauri HTTP', async () => {
    const source = '//img.shields.io/badge/Rust-1.94-000000?style=flat-square'
    const expectedProtocol = location.protocol === 'http:' ? 'http:' : 'https:'
    mocks.fetch.mockResolvedValue({
      blob: vi.fn().mockResolvedValue(new Blob(['image'])),
      headers: new Headers({ 'content-type': 'image/png' }),
      ok: true,
    })

    await expect(getImageUrlInTauri(source)).resolves.toBe('blob:remote-image')
    expect(mocks.fetch).toHaveBeenCalledWith(`${expectedProtocol}${source}`, {
      maxRedirections: 5,
      method: 'GET',
      mode: 'cors',
    })
  })

  it('falls back to the original URL when the native request fails', async () => {
    const source = 'https://example.invalid/unavailable.jpg'
    mocks.fetch.mockRejectedValue(new Error('offline'))

    await expect(getImageUrlInTauri(source)).resolves.toBe(source)
    expect(mocks.loggerWarn).toHaveBeenCalledOnce()
  })
})
