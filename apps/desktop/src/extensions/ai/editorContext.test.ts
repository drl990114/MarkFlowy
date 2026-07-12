import type { IFile } from '@markflowy/interface'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/helper/files', () => ({ getFileObject: vi.fn() }))
vi.mock('@/stores/useEditorStore', () => ({
  default: { getState: () => ({ activeId: undefined, opened: [] }) },
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
import {
  MAX_EDITOR_CONTEXT_TOKENS,
  addEditorContextReference,
  allocateFairTokenBudgets,
  freezeEditorContexts,
  serializeEditorContexts,
} from './editorContext'

const file = (overrides: Partial<IFile>): IFile => ({
  id: 'file',
  kind: 'file',
  name: 'file.md',
  ...overrides,
})

describe('editor context snapshots', () => {
  it('deduplicates references by normalized path and enforces the eight-file limit', () => {
    const first = { id: 'a', name: 'a.md', path: '/workspace/a.md' }
    expect(addEditorContextReference([first], { ...first, id: 'other' })).toEqual([first])

    const eight = Array.from({ length: 8 }, (_, index) => ({
      id: String(index),
      name: `${index}.md`,
    }))
    expect(addEditorContextReference(eight, { id: '9', name: '9.md' })).toEqual(eight)
  })

  it('uses the latest cached unsaved content before disk', async () => {
    const readFile = async () => ({ code: 'Success', content: 'disk' })
    const result = await freezeEditorContexts(
      [{ id: 'a', name: 'a.md', path: '/a.md' }],
      { getFile: () => file({ id: 'a', path: '/a.md', content: 'unsaved' }), readFile },
    )

    expect(result).toMatchObject({ ok: true, contexts: [{ content: 'unsaved' }] })
  })

  it.each([
    ['missing', undefined, 'Success'],
    ['binary', file({ content: undefined, path: '/a' }), 'Binary'],
    ['unreadable', file({ content: undefined, path: '/a' }), 'PermissionDenied'],
  ] as const)('blocks the batch when a file is %s', async (code, current, resultCode) => {
    const result = await freezeEditorContexts(
      [{ id: 'a', name: 'a.md', path: '/a' }],
      {
        getFile: () => current,
        readFile: async () => ({ code: resultCode, content: '' }),
      },
    )
    expect(result).toEqual({
      ok: false,
      failures: [{ id: 'a', name: 'a.md', path: '/a', code }],
    })
  })

  it('blocks a deleted on-disk file even when an unsaved cache snapshot exists', async () => {
    const result = await freezeEditorContexts(
      [{ id: 'a', name: 'a.md', path: '/a' }],
      {
        getFile: () => file({ id: 'a', path: '/a', content: 'unsaved' }),
        readFile: async () => ({ code: 'NotFound', content: '' }),
      },
    )
    expect(result).toMatchObject({ ok: false, failures: [{ code: 'unreadable' }] })
  })

  it('allocates the total budget fairly without penalizing small files', () => {
    expect(allocateFairTokenBudgets([1_000, 4_000, 4_000], 8_000)).toEqual([
      1_000, 3_500, 3_500,
    ])
    expect(allocateFairTokenBudgets([9, 9], 1)).toEqual([1, 0])
  })

  it('caps each file at 4k and all files at 8k with explicit truncation markers', async () => {
    const files = new Map([
      ['a', file({ id: 'a', name: 'a.md', content: '你'.repeat(6_000) })],
      ['b', file({ id: 'b', name: 'b.md', content: '你'.repeat(6_000) })],
      ['c', file({ id: 'c', name: 'c.md', content: '你'.repeat(6_000) })],
    ])
    const result = await freezeEditorContexts(
      [...files.values()].map(({ id, name }) => ({ id, name })),
      {
        getFile: (id) => files.get(id),
        readFile: async () => ({ code: 'Success', content: '' }),
      },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.contexts.reduce((sum, context) => sum + context.tokenCount, 0)).toBe(
      MAX_EDITOR_CONTEXT_TOKENS,
    )
    expect(result.contexts.every((context) => context.truncated)).toBe(true)
    expect(serializeEditorContexts('question', result.contexts)).toContain(
      '[Context truncated at the token budget]',
    )
  })
})
