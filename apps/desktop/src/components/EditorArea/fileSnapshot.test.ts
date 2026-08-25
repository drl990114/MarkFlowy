import { FileResultCode, type FileSysResult } from '@/helper/filesys'
import { describe, expect, it, vi } from 'vitest'
import { readStableFileSnapshot, type FileSnapshotReader } from './fileSnapshot'

const success = (content: string): FileSysResult => ({
  code: FileResultCode.Success,
  content,
})

describe('readStableFileSnapshot', () => {
  it('returns content only when the revision stays stable across the read', async () => {
    const reader: FileSnapshotReader = {
      getRevision: vi.fn().mockResolvedValue('disk:one'),
      readContent: vi.fn().mockResolvedValue(success('content')),
    }

    await expect(readStableFileSnapshot('/notes/file.md', reader)).resolves.toEqual({
      content: 'content',
      revision: 'disk:one',
      status: 'success',
    })
  })

  it('retries when a write changes the revision during the read', async () => {
    const reader: FileSnapshotReader = {
      getRevision: vi
        .fn()
        .mockResolvedValueOnce('disk:one')
        .mockResolvedValueOnce('disk:two')
        .mockResolvedValueOnce('disk:two')
        .mockResolvedValueOnce('disk:two'),
      readContent: vi
        .fn()
        .mockResolvedValueOnce(success('partial'))
        .mockResolvedValueOnce(success('complete')),
    }

    await expect(readStableFileSnapshot('/notes/file.md', reader)).resolves.toEqual({
      content: 'complete',
      revision: 'disk:two',
      status: 'success',
    })
    expect(reader.readContent).toHaveBeenCalledTimes(2)
  })

  it('returns the filesystem failure without retrying a missing file', async () => {
    const missing: FileSysResult = {
      code: FileResultCode.NotFound,
      content: 'missing',
    }
    const reader: FileSnapshotReader = {
      getRevision: vi.fn().mockResolvedValue('missing'),
      readContent: vi.fn().mockResolvedValue(missing),
    }

    await expect(readStableFileSnapshot('/notes/file.md', reader)).resolves.toEqual({
      result: missing,
      status: 'unavailable',
    })
    expect(reader.getRevision).toHaveBeenCalledOnce()
  })
})
