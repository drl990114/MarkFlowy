import { act, cleanup, renderHook } from '@testing-library/react'
import { StrictMode, useEffect, type PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRemoteImageResources } from './useRemoteImageResources'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: fetchMock }))

beforeEach(() => {
  let nextUrl = 0
  fetchMock.mockReset().mockImplementation(async () => new Response('image'))
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:editor-${++nextUrl}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(async () => {
  cleanup()
  await act(async () => {})
  vi.restoreAllMocks()
})

describe('editor image lifecycle', () => {
  it('survives StrictMode replay, then releases on real unmount', async () => {
    const wrapper = ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>
    const { result, unmount } = renderHook(() => {
      const images = useRemoteImageResources('strict-mode')
      useEffect(() => { void images.resolve('https://example.com/strict.png') }, [images])
      return images
    }, { wrapper })
    await act(async () => {
      await expect(result.current.resolve('https://example.com/strict.png')).resolves.toMatch(/^blob:/)
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    unmount()
    await act(async () => {})
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('preserves a split pane image until both editor instances unmount', async () => {
    const first = renderHook(() => useRemoteImageResources('same-file'))
    const second = renderHook(() => useRemoteImageResources('same-file'))
    const source = 'https://example.com/split.png'
    const firstUrl = await first.result.current.resolve(source)
    await expect(second.result.current.resolve(source)).resolves.toBe(firstUrl)
    expect(fetchMock).toHaveBeenCalledOnce()

    first.unmount()
    await act(async () => {})
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    second.rerender()
    await expect(second.result.current.resolve(source)).resolves.toBe(firstUrl)
    second.unmount()
    await act(async () => {})
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(firstUrl)
  })

  it('releases the previous file on identity change and fetches a fresh URL on reopen', async () => {
    const editor = renderHook(({ id }) => useRemoteImageResources(id), { initialProps: { id: 'first' } })
    const oldScope = editor.result.current
    const source = 'https://example.com/reopen.png'
    const oldUrl = await oldScope.resolve(source)
    editor.rerender({ id: 'second' })
    await act(async () => {})
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith(oldUrl)

    editor.rerender({ id: 'first' })
    const newUrl = await editor.result.current.resolve(source)
    expect(newUrl).not.toBe(oldUrl)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await expect(oldScope.resolve(source)).resolves.toBe(source)
  })
})
