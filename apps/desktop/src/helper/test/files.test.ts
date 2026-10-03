import { beforeEach, describe, expect, it, vi } from 'vitest'
import useFileCacheStore, {
  deleteFileObject,
  deleteFileObjectsByPathPrefix,
  getFileObject,
  getFileObjectByPath,
  releaseFileContent,
  pruneFileMetadata,
  getFileIdsByPathIdentity,
  getFileIdsByPathPrefix,
  moveFileObjectsByPathPrefix,
  setFileObject,
  setFileObjectByPath,
  setFileObjects,
} from '../files'

const FILE = {
  id: 'file-1',
  name: 'note.md',
  kind: 'file' as const,
  path: '/workspace/note.md',
  content: 'initial',
}

describe('file cache metadata revision', () => {
  beforeEach(() => {
    useFileCacheStore.setState({
      entries: {},
      contentEntries: {},
      metadataRevision: 0,
      pathEntries: {},
    })
  })

  it('does not change when only editor content changes', () => {
    setFileObject(FILE.id, FILE)
    const revision = useFileCacheStore.getState().metadataRevision

    setFileObject(FILE.id, { ...FILE, content: 'updated' })

    expect(useFileCacheStore.getState().metadataRevision).toBe(revision)
  })

  it('retains the cache identity for equal files but publishes metadata and child changes', () => {
    setFileObject(FILE.id, FILE)
    const original = useFileCacheStore.getState()
    const listener = vi.fn()
    const unsubscribe = useFileCacheStore.subscribe(listener)
    try {
      setFileObject(FILE.id, { ...FILE })
      expect(useFileCacheStore.getState()).toBe(original)
      expect(listener).not.toHaveBeenCalled()

      const withExtension = { ...FILE, ext: 'md' }
      setFileObject(FILE.id, withExtension)
      expect(getFileObject(FILE.id)).toBe(withExtension)
      expect(useFileCacheStore.getState().entries[FILE.id].content).toBeUndefined()

      const pending = { ...withExtension, kind: 'pending_edit_file' as const }
      setFileObject(FILE.id, pending)
      const withChildren = { ...pending, children: [{ ...FILE, id: 'child' }] }
      setFileObject(FILE.id, withChildren)
      const replacedChildren = { ...withChildren, children: [{ ...FILE, id: 'other-child' }] }
      setFileObject(FILE.id, replacedChildren)
      expect(listener).toHaveBeenCalledTimes(4)
      expect(useFileCacheStore.getState().entries[FILE.id].children?.[0]).toMatchObject({ id: 'other-child' })
      expect(useFileCacheStore.getState().entries[FILE.id].children?.[0].content).toBeUndefined()
      expect(useFileCacheStore.getState().metadataRevision).toBe(original.metadataRevision)
    } finally {
      unsubscribe()
    }
  })

  it('updates and releases a body without copying the directory index or retaining it in tree nodes', () => {
    setFileObjects(Array.from({ length: 10000 }, (_, index) => ({
      id: `entry-${index}`,
      file: { id: `entry-${index}`, name: `${index}.md`, kind: 'file' as const },
    })))
    setFileObject(FILE.id, FILE)
    setFileObjectByPath(FILE.path, FILE)
    setFileObject('root', { id: 'root', name: 'workspace', kind: 'dir', children: [FILE] })
    const { entries, pathEntries } = useFileCacheStore.getState()
    setFileObject(FILE.id, { ...FILE, content: 'updated' })
    expect(useFileCacheStore.getState().entries).toBe(entries)
    expect(useFileCacheStore.getState().pathEntries).toBe(pathEntries)
    expect(getFileObjectByPath(FILE.path)?.content).toBe('updated')
    releaseFileContent(FILE.id)
    expect(getFileObject(FILE.id).name).toBe(FILE.name)
    expect(getFileObject(FILE.id).content).toBeUndefined()
    expect(getFileObjectByPath(FILE.path)?.content).toBeUndefined()
    expect(entries.root.children?.[0].content).toBeUndefined()
    expect(Object.keys(useFileCacheStore.getState().contentEntries)).toEqual([])
  })

  it('prunes previous workspace metadata while retaining active files and pending document bodies', () => {
    setFileObjects([
      { id: FILE.id, file: FILE },
      { id: 'closed', file: { id: 'closed', name: 'closed.md', kind: 'file', path: '/old/closed.md' } },
      { id: 'opened', file: { id: 'opened', name: 'opened.md', kind: 'file', path: '/old/opened.md' } },
      { id: 'current', file: { id: 'current', name: 'current.md', kind: 'file', path: '/new/current.md' } },
    ])
    setFileObjectByPath('/old/closed.md', getFileObject('closed'))
    pruneFileMetadata('/new', ['opened'])
    expect(Object.keys(useFileCacheStore.getState().entries).sort()).toEqual(['current', FILE.id, 'opened'].sort())
    expect(useFileCacheStore.getState().pathEntries['/old/closed.md']).toBeUndefined()
    expect(getFileObject(FILE.id).content).toBe(FILE.content)
    releaseFileContent(FILE.id)
    pruneFileMetadata('/new', ['opened'])
    expect(getFileObject(FILE.id)).toBeUndefined()
  })

  it('changes when an opened-file name or path can change', () => {
    setFileObject(FILE.id, FILE)
    const revision = useFileCacheStore.getState().metadataRevision

    setFileObject(FILE.id, {
      ...FILE,
      name: 'renamed.md',
      path: '/workspace/renamed.md',
    })

    expect(useFileCacheStore.getState().metadataRevision).toBe(revision + 1)
  })

  it('increments once for a metadata-changing batch', () => {
    setFileObjects([
      { id: FILE.id, file: FILE },
      {
        id: 'file-2',
        file: { ...FILE, id: 'file-2', name: 'other.md', path: '/workspace/other.md' },
      },
    ])

    expect(useFileCacheStore.getState().metadataRevision).toBe(1)
  })

  it('rebases cached descendants while preserving unsaved content', () => {
    const nestedFile = {
      ...FILE,
      path: '/workspace/folder/nested/note.md',
      content: 'unsaved content',
    }
    setFileObject(nestedFile.id, nestedFile)
    setFileObjectByPath(nestedFile.path, nestedFile)
    const workspaceRoot = {
      id: 'workspace-root',
      name: 'workspace',
      kind: 'dir' as const,
      path: '/workspace',
      children: [
        {
          id: 'folder',
          name: 'folder',
          kind: 'dir' as const,
          path: '/workspace/folder',
          children: [nestedFile],
        },
      ],
    }
    setFileObject(workspaceRoot.id, workspaceRoot)
    setFileObjectByPath(workspaceRoot.path, workspaceRoot)
    const revision = useFileCacheStore.getState().metadataRevision

    moveFileObjectsByPathPrefix('/workspace/folder', '/workspace/renamed')

    const state = useFileCacheStore.getState()
    expect(getFileObject(nestedFile.id)).toMatchObject({
      content: 'unsaved content',
      path: '/workspace/renamed/nested/note.md',
    })
    expect(state.pathEntries[nestedFile.path]).toBeUndefined()
    expect(state.pathEntries['/workspace/renamed/nested/note.md'].content).toBeUndefined()
    expect(getFileObjectByPath('/workspace/renamed/nested/note.md')).toMatchObject({
      content: 'unsaved content',
    })
    expect(state.entries[workspaceRoot.id].children?.[0]).toMatchObject({
      path: '/workspace/renamed',
      children: [{ path: '/workspace/renamed/nested/note.md' }],
    })
    expect(state.metadataRevision).toBe(revision + 1)
  })

  it('removes a replaced folder and all cached descendants', () => {
    const nestedFile = {
      ...FILE,
      path: '/workspace/target/nested/note.md',
    }
    setFileObject(nestedFile.id, nestedFile)
    setFileObjectByPath(nestedFile.path, nestedFile)

    const deletedIds = deleteFileObjectsByPathPrefix('/workspace/target')

    expect(deletedIds).toEqual([nestedFile.id])
    expect(useFileCacheStore.getState().entries[nestedFile.id]).toBeUndefined()
    expect(useFileCacheStore.getState().pathEntries[nestedFile.path]).toBeUndefined()
  })

  it('removes one replaced id and all of its stale path aliases', () => {
    const aliasPath = '/workspace/alias.md'
    setFileObject(FILE.id, FILE)
    setFileObjectByPath(FILE.path, FILE)
    setFileObjectByPath(aliasPath, FILE)

    expect(deleteFileObject(FILE.id)).toEqual(FILE)

    const state = useFileCacheStore.getState()
    expect(state.entries[FILE.id]).toBeUndefined()
    expect(state.pathEntries[FILE.path]).toBeUndefined()
    expect(state.pathEntries[aliasPath]).toBeUndefined()
  })

  it('matches only path-segment descendants on POSIX and Windows paths', () => {
    setFileObjects([
      {
        id: 'posix-child',
        file: { ...FILE, id: 'posix-child', path: '/workspace/target/note.md' },
      },
      {
        id: 'posix-sibling',
        file: { ...FILE, id: 'posix-sibling', path: '/workspace/targeted/note.md' },
      },
      {
        id: 'windows-child',
        file: { ...FILE, id: 'windows-child', path: 'C:\\workspace\\target\\note.md' },
      },
    ])

    expect(getFileIdsByPathPrefix('/workspace/target')).toEqual(['posix-child'])
    expect(getFileIdsByPathPrefix('c:\\WORKSPACE\\TARGET\\')).toEqual(['windows-child'])
  })

  it('finds lexical path aliases without folding POSIX casing', () => {
    setFileObjects([
      {
        id: 'windows-alias',
        file: { ...FILE, id: 'windows-alias', path: 'C:\\Workspace\\Note.md' },
      },
      {
        id: 'posix-different-case',
        file: { ...FILE, id: 'posix-different-case', path: '/workspace/Note.md' },
      },
    ])

    expect(getFileIdsByPathIdentity('c:/workspace/note.md')).toEqual(['windows-alias'])
    expect(getFileIdsByPathIdentity('/workspace/note.md')).not.toContain('posix-different-case')
  })
})
