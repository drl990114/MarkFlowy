import { beforeEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, { getFileObject } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import useEditorStore from '@/stores/useEditorStore'
import { openBookmark } from '@/extensions/bookmarks/actions'
import { addExistingMarkdownFileEdit } from './editor-file'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('zens', () => ({ toast: { error: vi.fn() } }))

beforeEach(() => {
  useFileCacheStore.setState({ entries: {}, contentEntries: {}, pathEntries: {}, metadataRevision: 0 })
  useEditorStore.getState().setEditorLayout({ type: 'leaf', id: 'group', opened: [] }, 'group')
})

describe('explicit file opening', () => {
  it.each(['open file', 'bookmark'] as const)('keeps an existing preview through %s without replacing its contents', async (source) => {
    const file = createFile({ name: 'note.md', path: '/workspace/note.md', content: 'live content' })
    useEditorStore.getState().openFileInGroup('group', file.id, { mode: 'preview' })
    expect(useEditorStore.getState().getGroup('group')?.previewId).toBe(file.id)

    if (source === 'open file') {
      await addExistingMarkdownFileEdit({ fileName: file.name, path: file.path!, content: 'older disk content' })
    } else {
      openBookmark({ id: 'bookmark', title: file.name, target: { kind: 'localFile', path: file.path! }, tags: [], createdAt: 0 })
    }

    expect(useEditorStore.getState().getGroup('group')?.previewId).toBeUndefined()
    const next = createFile({ name: 'next.md', path: '/workspace/next.md' })
    useEditorStore.getState().openFileInGroup('group', next.id, { mode: 'preview' })
    expect(useEditorStore.getState().getGroup('group')?.opened).toEqual([file.id, next.id])
    expect(getFileObject(file.id).content).toBe('live content')
  })
})
