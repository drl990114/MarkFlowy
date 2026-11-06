import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import useFileCacheStore from '@/helper/files'
import { createFile } from '@/helper/filesys'
import useRecentFilesStore from '@/stores/useRecentFilesStore'
import { startSharedRecentFileHistory, type RecentFileSnapshot } from './recent-file-history'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn() }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))

let receive: (event: { payload: RecentFileSnapshot }) => void
let history: Awaited<ReturnType<typeof startSharedRecentFileHistory>> | undefined
const unlisten = vi.fn()
const paths = () =>
  useRecentFilesStore.getState().entries.map((entry) => entry.path ?? entry.fileId)

beforeEach(() => {
  vi.clearAllMocks()
  useFileCacheStore.setState({ entries: {}, pathEntries: {}, metadataRevision: 0 })
  useRecentFilesStore.setState({ entries: [], shared: false, restoring: false })
  vi.mocked(listen).mockImplementation(async (_name, callback) => {
    receive = callback as typeof receive
    return unlisten
  })
  vi.mocked(invoke).mockResolvedValue({ revision: 1, paths: ['/other-window/announcements.md'] })
})

afterEach(async () => {
  await history?.dispose().catch(() => undefined)
  history = undefined
})

describe('shared recent file history', () => {
  it('keeps local file identities when an earlier response temporarily omits a pending visit', async () => {
    history = await startSharedRecentFileHistory()
    const first = createFile({ path: '/first.md' })
    const second = createFile({ path: '/second.md' })
    vi.mocked(invoke)
      .mockResolvedValueOnce({ revision: 2, paths: ['/first.md'] })
      .mockResolvedValueOnce({ revision: 3, paths: ['/second.md', '/first.md'] })
    useRecentFilesStore.getState().visit({ path: first.path!, fileId: first.id })
    useRecentFilesStore.getState().visit({ path: second.path!, fileId: second.id })
    await history.flush()
    expect(useRecentFilesStore.getState().entries[0]).toEqual({
      path: second.path,
      fileId: second.id,
    })
  })

  it('loads files from another window and propagates visits without publishing received snapshots', async () => {
    history = await startSharedRecentFileHistory()
    expect(paths()).toEqual(['/other-window/announcements.md'])
    useRecentFilesStore.getState().visit({ path: '/current.md', fileId: 'current' })
    vi.mocked(invoke).mockResolvedValue({
      revision: 2,
      paths: ['/current.md', '/other-window/announcements.md'],
    })
    await history.flush()
    expect(paths()).toEqual(['/current.md', '/other-window/announcements.md'])
    expect(useRecentFilesStore.getState().entries[0].fileId).toBe('current')
    expect(invoke).toHaveBeenLastCalledWith('recent_file_history', {
      mutation: { type: 'visit', path: '/current.md' },
    })
    receive({ payload: { revision: 3, paths: ['/third-window.md', '/current.md'] } })
    await history.flush()
    expect(paths()).toEqual(['/third-window.md', '/current.md'])
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('ignores an old initial response after receiving a newer event and preserves local drafts', async () => {
    useRecentFilesStore.setState({ entries: [{ fileId: 'draft' }] })
    vi.mocked(invoke).mockImplementation(async () => {
      receive({ payload: { revision: 5, paths: ['/new.md'] } })
      return { revision: 4, paths: ['/old.md'] }
    })
    history = await startSharedRecentFileHistory()
    expect(paths()).toEqual(['draft', '/new.md'])
  })

  it('serializes local changes and does not let an old command response undo a remote clear', async () => {
    history = await startSharedRecentFileHistory()
    let resolve!: (snapshot: RecentFileSnapshot) => void
    vi.mocked(invoke).mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    useRecentFilesStore.getState().visit({ path: '/A.md' })
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledTimes(2))
    useRecentFilesStore.getState().clear()
    expect(invoke).toHaveBeenCalledTimes(2)
    receive({ payload: { revision: 9, paths: [] } })
    vi.mocked(invoke).mockResolvedValue({ revision: 10, paths: [] })
    resolve({ revision: 8, paths: ['/A.md'] })
    await history.flush()
    expect(paths()).toEqual([])
    expect(invoke).toHaveBeenLastCalledWith('recent_file_history', { mutation: { type: 'clear' } })
  })

  it('publishes Save As, rename and deletion even for paths absent from this window', async () => {
    history = await startSharedRecentFileHistory()
    useRecentFilesStore.getState().replaceEntries([{ fileId: 'draft' }])
    useRecentFilesStore.getState().updateFilePath('draft', '/saved.md')
    useRecentFilesStore.getState().rebasePaths('/closed-folder', '/renamed-folder')
    useRecentFilesStore.getState().removePath('/remote-only.md')
    await history.flush()
    expect(vi.mocked(invoke).mock.calls.slice(1)).toEqual([
      ['recent_file_history', { mutation: { type: 'visit', path: '/saved.md' } }],
      [
        'recent_file_history',
        { mutation: { type: 'rebase', path: '/closed-folder', newPath: '/renamed-folder' } },
      ],
      ['recent_file_history', { mutation: { type: 'remove', path: '/remote-only.md' } }],
    ])
  })

  it('releases its event listener if the initial read fails', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('unreadable history'))
    await expect(startSharedRecentFileHistory()).rejects.toThrow('unreadable history')
    expect(unlisten).toHaveBeenCalledOnce()
  })

  it('retries a failed mutation before applying later changes', async () => {
    history = await startSharedRecentFileHistory()
    vi.mocked(invoke).mockRejectedValue(new Error('temporary write failure'))
    useRecentFilesStore.getState().visit({ path: '/retry.md' })
    await expect(history.flush()).rejects.toThrow('temporary write failure')
    vi.mocked(invoke)
      .mockClear()
      .mockResolvedValue({ revision: 2, paths: ['/retry.md'] })
    await history.flush()
    expect(invoke).toHaveBeenCalledWith('recent_file_history', {
      mutation: { type: 'visit', path: '/retry.md' },
    })
    expect(paths()).toEqual(['/retry.md'])
  })

  it('reports write failures to flush and stops publishing after disposal', async () => {
    history = await startSharedRecentFileHistory()
    vi.mocked(invoke).mockRejectedValue(new Error('disk full'))
    useRecentFilesStore.getState().clear()
    await expect(history.flush()).rejects.toThrow('disk full')
    await expect(history.dispose()).rejects.toThrow('disk full')
    vi.mocked(invoke).mockClear()
    useRecentFilesStore.getState().visit({ path: '/after-dispose.md' })
    expect(invoke).not.toHaveBeenCalled()
    history = undefined
  })
})
