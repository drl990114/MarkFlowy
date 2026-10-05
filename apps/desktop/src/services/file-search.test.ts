import { invoke } from '@tauri-apps/api/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchFiles } from './file-search'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
const request = {
  query: { dir: '/workspace', name_text: '.*', contents_text: 'needle' },
  options: {},
}
beforeEach(() => vi.mocked(invoke).mockReset())

describe('cancellable native file search', () => {
  it('sends cancellation with the exact request and rejects late results', async () => {
    let finish!: (result: object) => void
    vi.mocked(invoke).mockImplementation((command) =>
      command === 'search_files_async'
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Promise.resolve(),
    )
    const controller = new AbortController()
    const result = searchFiles(request, 'global', controller.signal)
    const args = vi.mocked(invoke).mock.calls[0][1] as { requestId: number }
    controller.abort()
    expect(invoke).toHaveBeenLastCalledWith('cancel_file_search', {
      requestId: args?.requestId,
      scope: 'global',
    })
    finish({ data: ['obsolete'] })
    await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('uses increasing generations and removes cancellation listeners on completion', async () => {
    vi.mocked(invoke).mockResolvedValue({ data: [] })
    const controller = new AbortController()
    await searchFiles(request, 'global', controller.signal)
    const first = (vi.mocked(invoke).mock.calls[0][1] as { requestId: number }).requestId
    controller.abort()
    expect(invoke).toHaveBeenCalledTimes(1)
    await searchFiles(request, 'quick_open')
    expect((vi.mocked(invoke).mock.calls[1][1] as { requestId: number }).requestId).toBeGreaterThan(
      first,
    )
    expect((vi.mocked(invoke).mock.calls[1][1] as { scope: string }).scope).toBe('quick_open')
  })

  it('does not start an already canceled request', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(searchFiles(request, 'global', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(invoke).not.toHaveBeenCalled()
  })
})
