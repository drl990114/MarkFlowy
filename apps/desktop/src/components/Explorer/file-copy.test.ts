import { describe, expect, it, vi } from 'vitest'
import {
  copyFileTreeNode,
  getCopyParentPath,
  type CopyFileTreeNodeOptions,
} from '../../../../../packages/interface/src/components/FileTree/file-copy'
import { SimpleTree } from '../../../../../packages/interface/src/components/FileTree/types'
import type { IFile } from '../../../../../packages/interface/src/types/file'
import { SavePathCoordinator } from '../EditorArea/savePathCoordinator'

function setup() {
  const source: IFile = {
    id: 'source',
    name: 'note.md',
    path: '/workspace/note.md',
    kind: 'file',
    ext: 'md',
    content: '# Unsaved edits',
  }
  const destination: IFile = {
    id: 'destination',
    name: 'docs',
    path: '/workspace/docs',
    kind: 'dir',
    children: [],
  }
  const root: IFile = {
    id: 'root',
    name: 'Workspace',
    path: '/workspace',
    kind: 'dir',
    children: [destination, source],
  }
  let data = [root]
  let nextId = 0
  const coordinator = new SavePathCoordinator()
  const copyFile = vi.fn(async () => '/workspace/note copy.md')
  const picker = vi.fn(async (): Promise<string | null> => '/workspace/docs')
  const options: CopyFileTreeNodeOptions = {
    root: { id: root.id, path: root.path! },
    source: { id: source.id, path: source.path! },
    parent: { id: root.id, path: root.path! },
    mode: 'duplicate',
    fileSystem: {
      copyFile,
      selectCopyDirectory: picker,
      runFileMutation: (operation) => coordinator.runFileMutation(operation),
    },
    getCurrentFolderData: () => data,
    setFolderData: vi.fn((next) => {
      data = next
    }),
    getFileObject: (id) => new SimpleTree(data).find(id)?.data,
    getFileObjectByPath: (path) => {
      const visit = (files: IFile[]): IFile | undefined => {
        for (const file of files) {
          if (file.path === path) return file
          const found = file.children ? visit(file.children) : undefined
          if (found) return found
        }
        return undefined
      }
      return visit(data)
    },
    canInsertIntoDirectory: () => true,
    createFile: vi.fn((file) => ({ ...file, id: `copy-${++nextId}` }) as IFile),
  }
  vi.spyOn(options.fileSystem, 'runFileMutation')
  return {
    options,
    source,
    destination,
    root,
    coordinator,
    copyFile,
    picker,
    data: () => data,
    replaceWorkspace: () => {
      data = [{ ...root, id: 'other-root', path: '/other', children: [] }]
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('FileTree file copy transactions', () => {
  it('duplicates using only the saved-file adapter and leaves the source content intact', async () => {
    const { options, source, data, coordinator, copyFile, picker } = setup()
    copyFile.mockImplementation(async () => {
      expect(coordinator.isFileReserved(source.id, source.path)).toBe(true)
      return '/workspace/note copy.md'
    })
    expect(await copyFileTreeNode(options)).toBe('/workspace/note copy.md')
    expect(copyFile).toHaveBeenCalledWith('/workspace/note.md', undefined)
    expect(picker).not.toHaveBeenCalled()
    expect(source.content).toBe('# Unsaved edits')
    expect(data()[0].children?.map((file) => file.id)).toEqual(['destination', 'source', 'copy-1'])
    expect(data()[0].children?.[2].content).toBeUndefined()
    expect(coordinator.isFileReserved(source.id, source.path)).toBe(false)
  })

  it('keeps the picker outside the mutation queue and cancellation has no side effects', async () => {
    const { options, coordinator, picker, copyFile, source } = setup()
    const selection = deferred<string | null>()
    picker.mockReturnValue(selection.promise)
    const copying = copyFileTreeNode({ ...options, mode: 'copy-to' })
    expect(options.fileSystem.runFileMutation).not.toHaveBeenCalled()
    expect(coordinator.isFileReserved(source.id, source.path)).toBe(false)
    selection.resolve(null)
    expect(await copying).toBeNull()
    expect(copyFile).not.toHaveBeenCalled()
    expect(options.setFolderData).not.toHaveBeenCalled()
  })

  it.each(['workspace', 'rename', 'replacement'] as const)(
    'abandons a stale source after %s changes while choosing a destination',
    async (change) => {
      const { options, source, replaceWorkspace, picker, copyFile } = setup()
      const selection = deferred<string | null>()
      picker.mockReturnValue(selection.promise)
      const copying = copyFileTreeNode({ ...options, mode: 'copy-to' })
      if (change === 'workspace') replaceWorkspace()
      if (change === 'rename') source.path = '/workspace/renamed.md'
      if (change === 'replacement') source.id = 'replacement'
      selection.resolve('/workspace/docs')
      expect(await copying).toBeNull()
      expect(copyFile).not.toHaveBeenCalled()
      expect(options.setFolderData).not.toHaveBeenCalled()
    },
  )

  it('revalidates after waiting behind another filesystem mutation', async () => {
    const { options, coordinator, source, copyFile } = setup()
    const wait = deferred<void>()
    const earlier = coordinator.runFileMutation(() => wait.promise)
    const copying = copyFileTreeNode(options)
    source.path = '/workspace/renamed.md'
    wait.resolve()
    await earlier
    expect(await copying).toBeNull()
    expect(copyFile).not.toHaveBeenCalled()
  })

  it('updates the destination only and preserves drafts added during the copy', async () => {
    const { options, destination, root, copyFile, data } = setup()
    copyFile.mockImplementation(async () => {
      root.children!.push({ id: 'draft', name: '', kind: 'pending_new_file' })
      return '/workspace/docs/note.md'
    })
    await copyFileTreeNode({ ...options, mode: 'copy-to' })
    expect(copyFile).toHaveBeenCalledWith('/workspace/note.md', '/workspace/docs')
    expect(destination.children?.map((file) => file.path)).toEqual(['/workspace/docs/note.md'])
    expect(data()[0].children?.map((file) => file.id)).toEqual(['destination', 'source', 'draft'])
  })

  it('leaves an unloaded directory for the normal lazy read instead of inserting a partial listing', async () => {
    const { options, destination, copyFile } = setup()
    copyFile.mockResolvedValue('/workspace/docs/note.md')
    await copyFileTreeNode({ ...options, mode: 'copy-to', canInsertIntoDirectory: () => false })
    expect(destination.children).toEqual([])
    expect(options.createFile).not.toHaveBeenCalled()
    expect(options.setFolderData).not.toHaveBeenCalled()
  })

  it('does not insert a copy outside the workspace into the source folder', async () => {
    const { options, picker, copyFile } = setup()
    picker.mockResolvedValue('/elsewhere')
    copyFile.mockResolvedValue('/elsewhere/note.md')
    expect(await copyFileTreeNode({ ...options, mode: 'copy-to' })).toBe('/elsewhere/note.md')
    expect(options.createFile).not.toHaveBeenCalled()
    expect(options.setFolderData).not.toHaveBeenCalled()
  })

  it('does not commit a completed copy to a workspace opened during backend I/O', async () => {
    const { options, replaceWorkspace, copyFile, data } = setup()
    copyFile.mockImplementation(async () => {
      replaceWorkspace()
      return '/workspace/note copy.md'
    })
    expect(await copyFileTreeNode(options)).toBe('/workspace/note copy.md')
    expect(data()[0].children).toEqual([])
    expect(options.createFile).not.toHaveBeenCalled()
    expect(options.setFolderData).not.toHaveBeenCalled()
  })

  it('does not duplicate a node inserted by a directory read during backend I/O', async () => {
    const { options, root, copyFile } = setup()
    copyFile.mockImplementation(async () => {
      root.children!.push({
        id: 'loaded-copy',
        path: '/workspace/note copy.md',
        name: 'note copy.md',
        kind: 'file',
      })
      return '/workspace/note copy.md'
    })
    await copyFileTreeNode(options)
    expect(root.children?.filter((file) => file.path === '/workspace/note copy.md')).toHaveLength(1)
    expect(options.createFile).not.toHaveBeenCalled()
  })

  it('reports backend errors, releases protection and does not change the tree', async () => {
    const { options, copyFile, coordinator, source } = setup()
    copyFile.mockRejectedValue(new Error('Permission denied'))
    await expect(copyFileTreeNode(options)).rejects.toThrow('Permission denied')
    expect(options.createFile).not.toHaveBeenCalled()
    expect(options.setFolderData).not.toHaveBeenCalled()
    expect(coordinator.isFileReserved(source.id, source.path)).toBe(false)
  })

  it('matches Windows directory separators without putting the copy under the source parent', async () => {
    const { options, root, source, destination, picker, copyFile } = setup()
    root.path = 'C:\\workspace'
    source.path = 'C:\\workspace\\note.md'
    destination.path = 'C:\\workspace\\docs'
    picker.mockResolvedValue('C:/workspace/docs/')
    copyFile.mockResolvedValue('C:\\workspace\\docs\\note.md')
    await copyFileTreeNode({
      ...options,
      mode: 'copy-to',
      root: { id: root.id, path: root.path },
      parent: { id: root.id, path: root.path },
      source: { id: source.id, path: source.path },
    })
    expect(destination.children?.map((file) => file.name)).toEqual(['note.md'])
    expect(copyFile).toHaveBeenCalledWith('C:\\workspace\\note.md', 'C:\\workspace\\docs')
  })

  it.each([
    ['/note.md', '/'],
    ['/workspace/note.md', '/workspace'],
    ['C:\\note.md', 'C:\\'],
    ['C:\\workspace\\note.md', 'C:\\workspace'],
    ['\\\\server\\share\\note.md', '\\\\server\\share'],
  ])('formats the destination directory of %s', (path, expected) => {
    expect(getCopyParentPath(path)).toBe(expected)
  })
})
