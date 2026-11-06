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
  it('keeps pending visits visible and retains their local file identities across earlier responses', async () => {
    history = await startSharedRecentFileHistory()
    const first = createFile({ path: '/first.md' })
    const second = createFile({ path: '/second.md' })
    vi.mocked(invoke)
      .mockResolvedValueOnce({ revision: 2, paths: ['/first.md'] })
      .mockResolvedValueOnce({ revision: 3, paths: ['/second.md', '/first.md'] })
    useRecentFilesStore.getState().visit({ path: first.path!, fileId: first.id })
    useRecentFilesStore.getState().visit({ path: second.path!, fileId: second.id })
    const observed: (string | undefined)[] = []
    const unsubscribe = useRecentFilesStore.subscribe((state) => observed.push(state.entries[0]?.path))
    await history.flush()
    unsubscribe()
    expect(observed.length).toBeGreaterThan(0)
    expect(observed.every((path) => path === second.path)).toBe(true)
    expect(useRecentFilesStore.getState().entries[0]).toEqual({
      path: second.path,
      fileId: second.id,
    })
  })

  it('keeps drafts between saved files instead of moving them above each acknowledged visit', async () => {
    history = await startSharedRecentFileHistory()
    const store = useRecentFilesStore.getState()
    store.visit({ fileId: 'older-draft' })
    store.visit({ path: '/first.md' })
    store.visit({ fileId: 'newer-draft' })
    store.visit({ path: '/second.md' })
    vi.mocked(invoke)
      .mockResolvedValueOnce({ revision: 2, paths: ['/first.md', '/other-window/announcements.md'] })
      .mockResolvedValueOnce({ revision: 3, paths: ['/second.md', '/first.md', '/other-window/announcements.md'] })
    await history.flush()
    expect(paths()).toEqual([
      '/second.md', 'newer-draft', '/first.md', 'older-draft', '/other-window/announcements.md',
    ])
    receive({ payload: { revision: 4, paths: ['/second.md', '/first.md', '/other-window/announcements.md'] } })
    expect(paths()).toEqual([
      '/second.md', 'newer-draft', '/first.md', 'older-draft', '/other-window/announcements.md',
    ])
  })

  it('places remote visits ahead of older local drafts while retaining the remaining anchors', async () => {
    vi.mocked(invoke).mockResolvedValue({ revision: 1, paths: ['/first.md', '/older.md'] })
    history = await startSharedRecentFileHistory()
    useRecentFilesStore.getState().visit({ fileId: 'draft' })
    receive({ payload: { revision: 2, paths: ['/remote.md', '/first.md', '/older.md'] } })
    expect(paths()).toEqual(['/remote.md', 'draft', '/first.md', '/older.md'])
    receive({ payload: { revision: 3, paths: ['/older.md', '/remote.md', '/first.md'] } })
    expect(paths()).toEqual(['/older.md', '/remote.md', 'draft', '/first.md'])
    receive({ payload: { revision: 4, paths: ['/first.md', '/older.md', '/remote.md'] } })
    expect(paths()).toEqual(['/first.md', '/older.md', '/remote.md', 'draft'])
  })

  it('keeps a background Save As behind the more recently visited saved file and draft', async () => {
    history = await startSharedRecentFileHistory()
    const store = useRecentFilesStore.getState()
    store.visit({ fileId: 'saved-draft' })
    store.visit({ fileId: 'newer-draft' })
    store.visit({ path: '/active.md' })
    vi.mocked(invoke).mockResolvedValueOnce({
      revision: 2, paths: ['/active.md', '/other-window/announcements.md'],
    })
    await history.flush()
    store.updateFilePath('saved-draft', '/saved.md')
    vi.mocked(invoke).mockResolvedValueOnce({
      revision: 3, paths: ['/active.md', '/saved.md', '/other-window/announcements.md'],
    })
    await history.flush()
    expect(paths()).toEqual(['/active.md', 'newer-draft', '/saved.md', '/other-window/announcements.md'])
    expect(invoke).toHaveBeenLastCalledWith('recent_file_history', {
      mutation: { type: 'visit', path: '/saved.md', afterPath: '/active.md' },
    })
  })

  it('does not resurrect paths while a local rename and deletion wait for earlier writes', async () => {
    vi.mocked(invoke).mockResolvedValue({ revision: 1, paths: ['/old/a.md', '/deleted.md'] })
    history = await startSharedRecentFileHistory()
    const store = useRecentFilesStore.getState()
    store.visit({ path: '/first.md' })
    store.rebasePaths('/old', '/new')
    store.removePath('/deleted.md')
    const observed: string[][] = []
    const unsubscribe = useRecentFilesStore.subscribe(() => observed.push(paths()))
    vi.mocked(invoke)
      .mockResolvedValueOnce({ revision: 2, paths: ['/first.md', '/old/a.md', '/deleted.md'] })
      .mockResolvedValueOnce({ revision: 3, paths: ['/first.md', '/new/a.md', '/deleted.md'] })
      .mockResolvedValueOnce({ revision: 4, paths: ['/first.md', '/new/a.md'] })
    await history.flush()
    unsubscribe()
    expect(observed.length).toBeGreaterThan(0)
    expect(observed.every((entries) => entries.join(',') === '/first.md,/new/a.md')).toBe(true)
  })

  it('removes an acknowledged pending visit when a newer remote clear has already arrived', async () => {
    history = await startSharedRecentFileHistory()
    vi.mocked(invoke).mockImplementationOnce(async () => {
      receive({ payload: { revision: 3, paths: [] } })
      return { revision: 2, paths: ['/pending.md'] }
    })
    useRecentFilesStore.getState().visit({ path: '/pending.md' })
    await history.flush()
    expect(paths()).toEqual([])
  })

  it('does not reapply an in-flight nested rebase when its native event arrives before the response', async () => {
    vi.mocked(invoke).mockResolvedValue({ revision: 1, paths: ['/old/a.md'] })
    history = await startSharedRecentFileHistory()
    const observed: string[][] = []
    useRecentFilesStore.getState().rebasePaths('/old', '/old/nested')
    const unsubscribe = useRecentFilesStore.subscribe(() => observed.push(paths()))
    vi.mocked(invoke).mockImplementationOnce(async () => {
      const snapshot = { revision: 2, paths: ['/old/nested/a.md'] }
      receive({ payload: snapshot })
      expect(paths()).toEqual(['/old/nested/a.md'])
      return snapshot
    })
    await history.flush()
    unsubscribe()
    expect(observed.length).toBeGreaterThan(0)
    expect(observed.every((entries) => entries.join(',') === '/old/nested/a.md')).toBe(true)
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
