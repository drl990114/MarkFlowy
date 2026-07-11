import { describe, expect, it, vi } from 'vitest'
import { conditionalWriteWithRevision } from './conditionalFileWrite'

describe('conditionalWriteWithRevision', () => {
  it('passes the captured revision into the conditional write command', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce('sha256:before')
      .mockResolvedValueOnce({ status: 'success', revision: 'sha256:after' })

    await expect(
      conditionalWriteWithRevision('/workspace/note.md', 'content', invoke),
    ).resolves.toEqual({ status: 'success', revision: 'sha256:after' })

    expect(invoke).toHaveBeenNthCalledWith(1, 'get_file_write_revision', {
      filePath: '/workspace/note.md',
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'conditional_write_file', {
      content: 'content',
      expectedRevision: 'sha256:before',
      filePath: '/workspace/note.md',
    })
  })

  it('surfaces a cross-window revision conflict without retrying', async () => {
    const invoke = vi
      .fn()
      .mockResolvedValueOnce('missing')
      .mockResolvedValueOnce({ status: 'conflict', revision: 'sha256:other-window' })

    await expect(
      conditionalWriteWithRevision('/workspace/note.md', 'content', invoke),
    ).resolves.toEqual({ status: 'conflict', revision: 'sha256:other-window' })
    expect(invoke).toHaveBeenCalledTimes(2)
  })
})
