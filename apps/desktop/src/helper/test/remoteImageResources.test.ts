import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRemoteImageResources, type RemoteImageResources } from '../remoteImageResources'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: fetchMock }))

const deferred = <T>() => {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('remote image ownership', () => {
  const liveBlobs = new Map<string, Blob>()
  let scopes: RemoteImageResources[]
  let nextUrl: number
  const createScope = () => {
    const scope = createRemoteImageResources()
    scopes.push(scope)
    return scope
  }

  beforeEach(() => {
    scopes = []
    nextUrl = 0
    liveBlobs.clear()
    fetchMock.mockReset().mockImplementation(async () =>
      new Response(new Blob([new Uint8Array(64 * 1024)], { type: 'image/png' })),
    )
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      if (!('size' in blob)) throw new Error('Expected an image Blob')
      const url = `blob:test-${++nextUrl}`
      liveBlobs.set(url, blob)
      return url
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => { liveBlobs.delete(url) })
  })

  afterEach(() => {
    scopes.forEach((scope) => scope.dispose())
    vi.restoreAllMocks()
  })

  it('releases all 128 Blobs (8 MiB) after 16 editors close, then reloads on reopen', async () => {
    const editors = Array.from({ length: 16 }, createScope)
    await Promise.all(editors.flatMap((editor, index) =>
      Array.from({ length: 8 }, (_, image) =>
        editor.resolve(`https://example.com/${index}/${image}.png`),
      ),
    ))
    expect(liveBlobs.size).toBe(128)
    expect([...liveBlobs.values()].reduce((sum, blob) => sum + blob.size, 0)).toBe(8 * 1024 * 1024)

    editors.forEach((editor) => editor.dispose())
    expect(liveBlobs.size).toBe(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(128)

    const reopened = await createScope().resolve('https://example.com/0/0.png')
    expect(liveBlobs.has(reopened)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(129)
  })

  it('deduplicates repeated and cross-editor requests until the last owner releases', async () => {
    const first = createScope()
    const second = createScope()
    const source = 'https://example.com/shared.png'
    const urls = await Promise.all([first.resolve(source), first.resolve(source), second.resolve(source)])
    expect(new Set(urls).size).toBe(1)
    expect(fetchMock).toHaveBeenCalledOnce()
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal

    first.dispose()
    first.dispose()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await expect(second.resolve(source)).resolves.toBe(urls[0])
    second.dispose()
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(urls[0])
    expect(signal.aborted).toBe(false)
  })

  it('cancels a pending fetch and discards a late response after close', async () => {
    const response = deferred<Response>()
    fetchMock.mockReturnValue(response.promise)
    const editor = createScope()
    const source = 'https://example.com/pending.png'
    const result = editor.resolve(source)
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    editor.dispose()
    expect(signal.aborted).toBe(true)

    const lateResponse = new Response('image')
    const cancel = vi.spyOn(lateResponse.body!, 'cancel')
    response.resolve(lateResponse)
    await expect(result).resolves.toBe(source)
    expect(cancel).toHaveBeenCalledOnce()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    await expect(editor.resolve(source)).resolves.toBe(source)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('does not let an old body completion overwrite a reopened image', async () => {
    const body = deferred<Blob>()
    const oldResponse = new Response('old')
    const readBody = vi.spyOn(oldResponse, 'blob').mockReturnValue(body.promise)
    fetchMock.mockResolvedValueOnce(oldResponse)
    const source = 'https://example.com/reopened.png'
    const first = createScope()
    const oldResult = first.resolve(source)
    await vi.waitFor(() => expect(readBody).toHaveBeenCalledOnce())
    first.dispose()

    const second = createScope()
    const newUrl = await second.resolve(source)
    body.resolve(new Blob(['old']))
    await expect(oldResult).resolves.toBe(source)
    await expect(second.resolve(source)).resolves.toBe(newUrl)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(URL.createObjectURL).toHaveBeenCalledOnce()
    expect(liveBlobs.has(newUrl)).toBe(true)
  })

  it('keeps a shared pending download alive for its remaining editor', async () => {
    const response = deferred<Response>()
    fetchMock.mockReturnValue(response.promise)
    const first = createScope()
    const second = createScope()
    const source = 'https://example.com/shared-pending.png'
    const firstResult = first.resolve(source)
    const secondResult = second.resolve(source)
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    first.dispose()
    expect(signal.aborted).toBe(false)

    response.resolve(new Response('image'))
    await expect(firstResult).resolves.toBe(source)
    const url = await secondResult
    expect(liveBlobs.has(url)).toBe(true)
    second.dispose()
    expect(liveBlobs.size).toBe(0)
  })

  it('allows a failed request to retry and drops the failed response body', async () => {
    const failure = new Response('not an image', { status: 404 })
    const cancel = vi.spyOn(failure.body!, 'cancel')
    fetchMock.mockResolvedValueOnce(failure)
    const editor = createScope()
    const source = 'https://example.com/retry.png'
    await expect(editor.resolve(source)).rejects.toThrow('404')
    expect(cancel).toHaveBeenCalledOnce()
    const url = await editor.resolve(source)
    expect(liveBlobs.has(url)).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps exported images alive after closing the editor and releases them at export end', async () => {
    const editor = createScope()
    const releaseExport = editor.retain()
    const url = await editor.resolve('https://example.com/export.png')
    editor.dispose()
    expect(liveBlobs.has(url)).toBe(true)
    const lateUrl = await editor.resolve('https://example.com/export-offscreen.png')
    expect(liveBlobs.has(lateUrl)).toBe(true)

    releaseExport()
    releaseExport()
    editor.retain()()
    expect(liveBlobs.size).toBe(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2)
  })
})
