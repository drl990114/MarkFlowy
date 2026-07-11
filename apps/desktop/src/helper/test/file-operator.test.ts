import { describe, expect, it, vi } from 'vitest'
import { moveFileNode } from '../../../../../packages/interface/src/components/FileTree/file-operator'
import { SimpleTree } from '../../../../../packages/interface/src/components/FileTree/types'
import type { IFile } from '../../../../../packages/interface/src/types/file'

const createCachedTree = (root: IFile) => {
  const entries = new Map<string, IFile>()
  const pathEntries = new Map<string, IFile>()

  const visit = (file: IFile) => {
    entries.set(file.id, file)
    if (file.path) pathEntries.set(file.path, file)
    file.children?.forEach(visit)
  }
  visit(root)

  return {
    entries,
    pathEntries,
    deletePathEntry: (path: string) => pathEntries.delete(path),
    getFileObject: (id: string) => entries.get(id),
    getFileObjectByPath: (path: string) => pathEntries.get(path),
    setFileObject: (id: string, file: IFile) => entries.set(id, file),
    setFileObjectByPath: (path: string, file: IFile) => pathEntries.set(path, file),
  }
}

describe('moveFileNode', () => {
  it('rebases every loaded descendant without relying on backend children', () => {
    const file: IFile = {
      id: 'file',
      kind: 'file',
      name: 'note.md',
      path: '/workspace/old/nested/note.md',
      content: 'unsaved',
    }
    const nested: IFile = {
      id: 'nested',
      kind: 'dir',
      name: 'nested',
      path: '/workspace/old/nested',
      children: [file],
    }
    const folder: IFile = {
      id: 'folder',
      kind: 'dir',
      name: 'old',
      path: '/workspace/old',
      children: [nested],
    }
    const cache = createCachedTree(folder)
    const tree = new SimpleTree<IFile>([folder])

    moveFileNode(
      tree,
      {
        old_path: '/workspace/old',
        new_path: '/workspace/new',
        children: [],
        is_folder: true,
      },
      cache.getFileObject,
      cache.getFileObjectByPath,
      cache.deletePathEntry,
      cache.setFileObjectByPath,
      cache.setFileObject,
    )

    expect(tree.find('folder')?.data.path).toBe('/workspace/new')
    expect(tree.find('nested')?.data.path).toBe('/workspace/new/nested')
    expect(tree.find('file')?.data.path).toBe('/workspace/new/nested/note.md')
    expect(cache.entries.get('file')).toMatchObject({
      content: 'unsaved',
      path: '/workspace/new/nested/note.md',
    })
    expect(cache.pathEntries.has('/workspace/old/nested/note.md')).toBe(false)
  })

  it('cleans up a replaced subtree even when its path cache entry is absent', () => {
    const source: IFile = {
      id: 'source',
      kind: 'file',
      name: 'note.md',
      path: '/workspace/source/note.md',
    }
    const targetPath = '/workspace/target/note.md'
    const cache = createCachedTree(source)
    const tree = new SimpleTree<IFile>([source])
    const deleteFileObjectsByPathPrefix = vi.fn()

    moveFileNode(
      tree,
      {
        old_path: targetPath,
        new_path: '',
        children: [],
        is_folder: false,
        is_replaced: true,
      },
      cache.getFileObject,
      () => undefined,
      cache.deletePathEntry,
      cache.setFileObjectByPath,
      cache.setFileObject,
      undefined,
      deleteFileObjectsByPathPrefix,
    )

    expect(tree.find(source.id)).not.toBeNull()
    expect(deleteFileObjectsByPathPrefix).toHaveBeenCalledWith(targetPath)
  })
})
