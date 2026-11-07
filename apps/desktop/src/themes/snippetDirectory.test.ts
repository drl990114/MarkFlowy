import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WatchEvent } from '@tauri-apps/plugin-fs'
const mocks = vi.hoisted(() => ({ watch: vi.fn(), unwatch: vi.fn() }))
vi.mock('@tauri-apps/plugin-fs', () => ({ watch: mocks.watch }))
import { watchSnippetDirectory } from './snippetDirectory'

let dispose: (() => void) | undefined
afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.clearAllMocks()
})
describe('CSS directory watching', () => {
  it('rescans after subscribing, ignores reads, refreshes on changes/focus and disposes', async () => {
    let onEvent: (event: WatchEvent) => void = () => undefined
    mocks.watch.mockImplementation(async (_path, callback) => {
      onEvent = callback
      return mocks.unwatch
    })
    const reload = vi.fn().mockResolvedValue(undefined)
    dispose = await watchSnippetDirectory('/config/css-snippets', reload)
    expect(mocks.watch).toHaveBeenCalledWith('/config/css-snippets', expect.any(Function), {
      delayMs: 400, recursive: false,
    })
    expect(reload).toHaveBeenCalledTimes(1)
    onEvent({ type: { access: { kind: 'open', mode: 'read' } }, paths: ['/config/css-snippets/a.css'], attrs: {} })
    expect(reload).toHaveBeenCalledTimes(1)
    onEvent({ type: 'any', paths: ['/config/css-snippets/a.css'], attrs: {} })
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(2))
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(3))
    dispose()
    dispose = undefined
    window.dispatchEvent(new Event('focus'))
    expect(reload).toHaveBeenCalledTimes(3)
    expect(mocks.unwatch).toHaveBeenCalledOnce()
  })

  it('coalesces overlapping changes and recovers after a failed read', async () => {
    let onEvent: (event: WatchEvent) => void = () => undefined
    mocks.watch.mockImplementation(async (_path, callback) => {
      onEvent = callback
      return mocks.unwatch
    })
    const reload = vi.fn().mockResolvedValue(undefined)
    dispose = await watchSnippetDirectory('/config/css-snippets', reload)
    let finish: () => void = () => undefined
    reload.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve }))
    const event: WatchEvent = { type: 'any', paths: [], attrs: {} }
    onEvent(event)
    onEvent(event)
    onEvent(event)
    expect(reload).toHaveBeenCalledTimes(2)
    finish()
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(3))
    reload.mockRejectedValueOnce(new Error('temporarily unavailable'))
    onEvent(event)
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(4))
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(5))
  })
})
