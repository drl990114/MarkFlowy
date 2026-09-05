import { FileResultCode } from '@/helper/filesys'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readStableFileSnapshot, type FileSnapshotResult } from './fileSnapshot'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

beforeEach(() => {
  invoke.mockReset()
})

describe('readStableFileSnapshot', () => {
  it('coalesces sibling opens only until the read settles', async () => {
    let resolve!: (value: FileSnapshotResult) => void
    invoke.mockReturnValueOnce(new Promise<FileSnapshotResult>((done) => { resolve = done }))
    const first = readStableFileSnapshot('/notes/shared.md', { reuseInFlight: true })
    const sibling = readStableFileSnapshot('/notes/shared.md', { reuseInFlight: true })
    expect(sibling).toBe(first)
    expect(invoke).toHaveBeenCalledOnce()
    resolve({ status: 'success', content: 'one', revision: 'one' })
    await first
    invoke.mockResolvedValue({ status: 'success', content: 'two', revision: 'two' })
    await expect(readStableFileSnapshot('/notes/shared.md', { reuseInFlight: true }))
      .resolves.toMatchObject({ content: 'two' })
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('never reuses an opening read for watcher or save validation', async () => {
    let resolve!: (value: FileSnapshotResult) => void
    invoke.mockReturnValueOnce(new Promise<FileSnapshotResult>((done) => { resolve = done }))
    const opening = readStableFileSnapshot('/notes/changing.md', { reuseInFlight: true })
    invoke.mockResolvedValue({ status: 'success', content: 'new', revision: 'new' })
    await expect(readStableFileSnapshot('/notes/changing.md')).resolves.toMatchObject({ revision: 'new' })
    await readStableFileSnapshot('/notes/different.md', { reuseInFlight: true })
    expect(invoke).toHaveBeenCalledTimes(3)
    resolve({ status: 'success', content: 'old', revision: 'old' })
    await opening
  })

  it('evicts failed shared reads so a retry issues a new native request', async () => {
    invoke.mockRejectedValueOnce(new Error('failed'))
    await expect(readStableFileSnapshot('/notes/retry.md', { reuseInFlight: true })).rejects.toThrow('failed')
    invoke.mockResolvedValue({ status: 'unstable' })
    await expect(readStableFileSnapshot('/notes/retry.md', { reuseInFlight: true })).resolves.toEqual({ status: 'unstable' })
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('gets content and its matching revision in one native command', async () => {
    const snapshot: FileSnapshotResult = {
      content: 'content',
      revision: 'disk:one',
      status: 'success',
    }
    invoke.mockResolvedValue(snapshot)

    await expect(readStableFileSnapshot('/notes/file.md')).resolves.toBe(snapshot)
    expect(invoke).toHaveBeenCalledExactlyOnceWith('get_file_snapshot', {
      filePath: '/notes/file.md',
    })
  })

  it.each([
    { status: 'unstable' },
    { status: 'unavailable', result: { code: FileResultCode.NotFound, content: 'missing' } },
    { status: 'unavailable', result: { code: FileResultCode.PermissionDenied, content: 'denied' } },
  ] satisfies FileSnapshotResult[])('preserves native failure results without extra reads: $status', async (snapshot) => {
    invoke.mockResolvedValue(snapshot)

    await expect(readStableFileSnapshot('/notes/file.md')).resolves.toBe(snapshot)
    expect(invoke).toHaveBeenCalledOnce()
  })

  it('propagates an IPC rejection for the caller to handle', async () => {
    const error = new Error('native reader failed')
    invoke.mockRejectedValue(error)

    await expect(readStableFileSnapshot('/notes/file.md')).rejects.toBe(error)
    expect(invoke).toHaveBeenCalledOnce()
  })
})
