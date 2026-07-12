import type { PendingAttachment } from '@assistant-ui/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/helper/files', () => ({ getFileObject: vi.fn() }))
vi.mock('@/stores/useEditorStore', () => ({
  default: { getState: () => ({ activeId: undefined, opened: [] }) },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
import { EditorContextAttachmentAdapter } from './editorContextAttachmentAdapter'

describe('EditorContextAttachmentAdapter', () => {
  it('rejects arbitrary files and accepts only editor references', async () => {
    const adapter = new EditorContextAttachmentAdapter(async () => ({ ok: true, contexts: [] }))
    await expect(adapter.add({ file: new File([], 'random.md') })).rejects.toThrow(
      'Only editor context references',
    )

    const pending = await adapter.add({
      file: adapter.createFile({ id: 'a', name: 'a.md', path: '/a.md' }),
    })
    expect(pending).toMatchObject({
      type: 'document',
      name: 'a.md',
      status: { type: 'requires-action', reason: 'composer-send' },
    })

    await expect(adapter.add({
      file: adapter.createFile({ id: 'duplicate', name: 'a.md', path: '/a.md' }),
    })).rejects.toThrow('already attached')
  })

  it('enforces the eight-context limit in the adapter', async () => {
    const adapter = new EditorContextAttachmentAdapter(async () => ({ ok: true, contexts: [] }))
    for (let index = 0; index < 8; index += 1) {
      await adapter.add({
        file: adapter.createFile({ id: String(index), name: `${index}.md` }),
      })
    }

    await expect(adapter.add({
      file: adapter.createFile({ id: 'overflow', name: 'overflow.md' }),
    })).rejects.toThrow('No more than 8')
  })

  it('freezes the whole batch before send and preserves the snapshot', async () => {
    const adapter = new EditorContextAttachmentAdapter(async (references) => ({
      ok: true,
      contexts: references.map((reference) => ({
        ...reference,
        content: 'frozen unsaved text',
        originalTokenCount: 5,
        tokenCount: 5,
        truncated: false,
      })),
    }))
    const pending = await adapter.add({
      file: adapter.createFile({ id: 'a', name: 'a.md' }),
    })
    expect(await adapter.prepare([pending])).toEqual({ ok: true })

    const complete = await adapter.send(pending as PendingAttachment)
    expect(complete.content[0]).toMatchObject({
      type: 'text',
      text: expect.stringContaining('frozen unsaved text'),
    })
  })

  it('returns per-chip errors and refuses an unprepared send', async () => {
    const adapter = new EditorContextAttachmentAdapter(async (references) => ({
      ok: false,
      failures: [{ ...references[0], code: 'binary' }],
    }))
    const pending = await adapter.add({
      file: adapter.createFile({ id: 'a', name: 'a.md' }),
    })
    expect(await adapter.prepare([pending])).toMatchObject({
      ok: false,
      failures: [{ code: 'binary', attachmentId: pending.id }],
    })
    await expect(adapter.send(pending as PendingAttachment)).rejects.toThrow('was not prepared')
  })
})
