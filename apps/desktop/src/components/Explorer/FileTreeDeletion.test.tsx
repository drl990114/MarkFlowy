import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'zens'
import type * as Zens from 'zens'
import type { FileTreeDeletionRequest } from '../../../../../packages/interface/src/components/FileTree/FileNode'
import FileTree, {
  fileTreeHandler,
  type FileTreeProps,
} from '../../../../../packages/interface/src/components/FileTree/FileTree'
import { SimpleTree } from '../../../../../packages/interface/src/components/FileTree/types'
import {
  FileSystemContext,
  type FileSystemContextValue,
} from '../../../../../packages/interface/src/contexts/FileSystemContext'
import { FileTreeContext } from '../../../../../packages/interface/src/contexts/FileTreeContext'
import type { IFile } from '../../../../../packages/interface/src/types/file'

vi.mock('@markflowy/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('zens', async (importOriginal) => ({
  ...(await importOriginal<typeof Zens>()),
  Input: (await import('../../../../../packages/zens/src/Input')).default,
  toast: { success: vi.fn(), error: vi.fn() },
}))

const protectFileIds = vi.fn()
const protectPaths = vi.fn()
const fileSystem: FileSystemContextValue = {
  runFileMutation: vi.fn((operation) => operation({ protectFileIds, protectPaths })),
  readDirectory: vi.fn(),
  readSubdirectory: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
  deleteFolder: vi.fn(),
  trashFile: vi.fn(),
  isDir: vi.fn(),
  fileExists: vi.fn(),
  pathsReferToSameDirectoryEntry: vi.fn(),
  moveFilesToTargetFolder: vi.fn(),
  pathJoin: vi.fn(),
  getPathName: vi.fn(),
  getFileContent: vi.fn(),
  getMdRelativePath: vi.fn(),
  createFolder: vi.fn(),
  renameFile: vi.fn(),
  copyFile: vi.fn(),
}
const onShowConfirm = vi.fn<FileTreeProps['onShowConfirm']>()
const onRequestDelete = vi.fn<NonNullable<FileTreeProps['onRequestDelete']>>()
const onShowContextMenu = vi.fn<FileTreeProps['onShowContextMenu']>()
const deleteNode = vi.fn<(file: IFile) => Promise<void>>()
const trashNode = vi.fn<(file: IFile) => Promise<void>>()
const files = new Map<string, IFile>()
const deleteCache = vi.fn((path: string) => {
  for (const [id, entry] of files) {
    if (entry.path === path || entry.path?.startsWith(`${path}/`)) files.delete(id)
  }
})
let data: IFile[]
let replaceData: (next: IFile[]) => void

function indexFiles(nodes: IFile[]) {
  for (const entry of nodes) {
    files.set(entry.id, entry)
    if (entry.children) indexFiles(entry.children)
  }
}

function file(id = 'source', parent = '/workspace'): IFile {
  return { id, name: `${id}.md`, path: `${parent}/${id}.md`, kind: 'file', ext: 'md' }
}

function FillFlexParent({ children }: {
  children: (dimensions: { width: number; height: number }) => ReactNode
}) {
  return children({ width: 340, height: 400 })
}

function Harness({ initial, legacy = false, stickyRoot = false }: {
  initial: IFile[]
  legacy?: boolean
  stickyRoot?: boolean
}) {
  const [state, setState] = useState(initial)
  data = state
  replaceData = (next) => {
    indexFiles(next)
    setState(next)
  }
  return (
    <ThemeProvider theme={desktopLightTheme}>
      <FileSystemContext.Provider value={fileSystem}>
        <FileTreeContext.Provider value={{
          folderData: state,
          setFolderData: replaceData,
          setFolderDataPure: replaceData,
          deleteNode,
          trashNode,
          getRootPath: () => state[0]?.path,
          refreshFolder: vi.fn(),
        }}>
          <FileTree
            data={state}
            fillFlexParentComponent={FillFlexParent}
            getFileObject={(id) => files.get(id)}
            getFileObjectByPath={(path) => [...files.values()].find((entry) => entry.path === path)}
            getFileIdsByPathPrefix={(path) => [...files.values()]
              .filter((entry) => entry.path === path || entry.path?.startsWith(`${path}/`))
              .map((entry) => entry.id)}
            deleteFileObjectsByPathPrefix={deleteCache}
            onSelect={vi.fn()}
            onShowConfirm={onShowConfirm}
            onRequestDelete={legacy ? undefined : onRequestDelete}
            onShowContextMenu={onShowContextMenu}
            stickyRoot={stickyRoot}
          />
        </FileTreeContext.Provider>
      </FileSystemContext.Provider>
    </ThemeProvider>
  )
}

function mount(children: IFile[], options: { legacy?: boolean; stickyRoot?: boolean } = {}) {
  const initial: IFile[] = [{
    id: 'root', name: 'Workspace', path: '/workspace', kind: 'dir', children,
  }]
  indexFiles(initial)
  return render(<Harness initial={initial} {...options} />)
}

function requestDeletion(mode: FileTreeDeletionRequest['mode'], name = 'source.md') {
  fireEvent.contextMenu(screen.getByText(name), { clientX: 40, clientY: 20 })
  const items = onShowContextMenu.mock.lastCall![0].items
  const action = items.find((item) => mode === 'trash'
    ? item.value === 'trash'
    : item.value === 'delete_file' || item.value === 'delete_folder')!
  act(() => action.handler!())
  return onRequestDelete.mock.lastCall?.[0]
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  files.clear()
  deleteNode.mockReset().mockResolvedValue(undefined)
  trashNode.mockReset().mockResolvedValue(undefined)
  vi.mocked(fileSystem.runFileMutation).mockReset().mockImplementation((operation) =>
    operation({ protectFileIds, protectPaths }),
  )
  vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('FileTree deletion confirmation', () => {
  it.each(['permanent', 'trash'] as const)('waits for %s confirmation and backend success before removing the entry', async (mode) => {
    const source = { ...file(), content: 'Unsaved text' }
    const backend = deferred()
    const operation = mode === 'permanent' ? deleteNode : trashNode
    operation.mockReturnValue(backend.promise)
    mount([source])
    const request = requestDeletion(mode)!

    expect(request).toMatchObject({ mode, file: {
      id: source.id, name: source.name, path: source.path, kind: source.kind, ext: source.ext,
    } })
    expect(request.file).not.toBe(source)
    expect(request.file.content).toBeUndefined()
    expect(onShowConfirm).not.toHaveBeenCalled()
    expect(fileSystem.runFileMutation).not.toHaveBeenCalled()
    expect(deleteNode).not.toHaveBeenCalled()
    expect(trashNode).not.toHaveBeenCalled()

    let confirmation!: Promise<void>
    await act(async () => { confirmation = request.onConfirm() })
    expect(operation).toHaveBeenCalledExactlyOnceWith(source)
    expect(protectFileIds).toHaveBeenCalledWith(['source'])
    expect(protectPaths).toHaveBeenCalledWith(['/workspace/source.md'])
    expect(deleteCache).not.toHaveBeenCalled()
    expect(files.get('source')).toBe(source)
    expect(new SimpleTree(data).find('source')).toBeTruthy()

    await act(async () => {
      backend.resolve()
      await confirmation
    })
    expect(deleteCache).toHaveBeenCalledExactlyOnceWith('/workspace/source.md')
    expect(files.has('source')).toBe(false)
    expect(new SimpleTree(data).find('source')).toBeNull()
    expect(screen.queryByText('source.md')).toBeNull()
  })

  it.each(['permanent', 'trash'] as const)('ignores a stale %s request after the entry is renamed', async (mode) => {
    const source = file()
    mount([source])
    const request = requestDeletion(mode)!
    await act(async () => {
      source.name = 'renamed.md'
      source.path = '/workspace/renamed.md'
      replaceData([...data])
    })

    expect(request.file).toMatchObject({ name: 'source.md', path: '/workspace/source.md' })
    await act(async () => request.onConfirm())
    expect(deleteNode).not.toHaveBeenCalled()
    expect(trashNode).not.toHaveBeenCalled()
    expect(deleteCache).not.toHaveBeenCalled()
    expect(new SimpleTree(data).find('source')?.data).toBe(source)
  })

  it('ignores confirmation after the workspace changes even if the old file remains cached', async () => {
    const source = file()
    mount([source])
    const request = requestDeletion('permanent')!
    const otherRoot: IFile = {
      id: 'other-root', name: 'Other', path: '/other', kind: 'dir',
      // The new tree may briefly retain shared cache entries during a workspace transition.
      children: [source, file('other', '/other')],
    }
    await act(async () => replaceData([otherRoot]))
    await act(async () => request.onConfirm())

    expect(files.get('source')).toBe(source)
    expect(deleteNode).not.toHaveBeenCalled()
    expect(deleteCache).not.toHaveBeenCalled()
    expect(data).toEqual([otherRoot])
  })

  it('ignores a saved host confirmation after the FileTree unmounts', async () => {
    const source = file()
    const view = mount([source])
    const request = requestDeletion('permanent')!
    view.unmount()
    await act(async () => request.onConfirm())

    expect(fileSystem.runFileMutation).not.toHaveBeenCalled()
    expect(deleteNode).not.toHaveBeenCalled()
    expect(trashNode).not.toHaveBeenCalled()
    expect(deleteCache).not.toHaveBeenCalled()
    expect(files.get('source')).toBe(source)
  })

  it('ignores a queued legacy confirmation after the FileTree unmounts', async () => {
    const source = file()
    const view = mount([source], { legacy: true })
    requestDeletion('trash')
    const confirmation = onShowConfirm.mock.lastCall![0].onConfirm
    view.unmount()
    await act(async () => confirmation())

    expect(trashNode).not.toHaveBeenCalled()
    expect(deleteCache).not.toHaveBeenCalled()
    expect(files.get('source')).toBe(source)
  })

  it('revalidates the captured target when a queued mutation receives its lease', async () => {
    const waiting = deferred()
    vi.mocked(fileSystem.runFileMutation).mockImplementation(async (operation) => {
      await waiting.promise
      return operation({ protectFileIds, protectPaths })
    })
    const source = file()
    mount([source])
    const request = requestDeletion('trash')!
    let confirmation!: Promise<void>
    await act(async () => { confirmation = request.onConfirm() })
    expect(fileSystem.runFileMutation).toHaveBeenCalledOnce()
    expect(trashNode).not.toHaveBeenCalled()

    await act(async () => {
      source.path = '/workspace/renamed.md'
      replaceData([...data])
      waiting.resolve()
      await confirmation
    })
    expect(trashNode).not.toHaveBeenCalled()
    expect(deleteCache).not.toHaveBeenCalled()
    expect(protectFileIds).not.toHaveBeenCalled()
    expect(files.get('source')?.path).toBe('/workspace/renamed.md')
  })

  it('preserves other branches updated while the backend operation is pending', async () => {
    const backend = deferred()
    deleteNode.mockReturnValue(backend.promise)
    const source = file()
    const other: IFile = {
      id: 'other', name: 'Other', kind: 'dir', path: '/workspace/other', children: [],
    }
    mount([source, other])
    const request = requestDeletion('permanent')!
    let confirmation!: Promise<void>
    await act(async () => { confirmation = request.onConfirm() })
    const loadedChild = file('loaded', '/workspace/other')
    await act(async () => replaceData(data.map((root) => ({
      ...root,
      children: root.children?.map((entry) => entry.id === 'other'
        ? { ...entry, children: [loadedChild] }
        : entry),
    }))))
    await act(async () => {
      backend.resolve()
      await confirmation
    })

    expect(new SimpleTree(data).find('source')).toBeNull()
    expect(new SimpleTree(data).find('loaded')?.data).toBe(loadedChild)
    expect(files.get('loaded')).toBe(loadedChild)
  })

  it.each(['permanent', 'trash'] as const)('protects cached descendants and keeps the folder intact after a %s failure', async (mode) => {
    const child = file('child', '/workspace/folder')
    const directory: IFile = {
      id: 'folder', name: 'Folder', path: '/workspace/folder', kind: 'dir', children: [child],
    }
    const cachedChild = file('cached-child', '/workspace/folder/unloaded')
    const operation = mode === 'permanent' ? deleteNode : trashNode
    operation.mockRejectedValue(new Error('Permission denied'))
    mount([directory])
    files.set(cachedChild.id, cachedChild)
    const request = requestDeletion(mode, 'Folder')!

    expect(request.file.children).toBeUndefined()
    await act(async () => request.onConfirm())
    expect(protectFileIds).toHaveBeenCalledWith(['folder', 'child', 'cached-child'])
    expect(protectPaths).toHaveBeenCalledWith([
      '/workspace/folder', '/workspace/folder/child.md', '/workspace/folder/unloaded/cached-child.md',
    ])
    expect(toast.error).toHaveBeenCalledExactlyOnceWith('Permission denied')
    expect(deleteCache).not.toHaveBeenCalled()
    expect(new SimpleTree(data).find('folder')?.data).toBe(directory)
    expect(files.get('folder')).toBe(directory)
    expect(files.get('child')).toBe(child)
    expect(files.get('cached-child')).toBe(cachedChild)
  })

  it.each(['permanent', 'trash'] as const)('deletes an internal folder with %s while preserving the workspace root', async (mode) => {
    const child = file('child', '/workspace/folder')
    const directory: IFile = {
      id: 'folder', name: 'Folder', path: '/workspace/folder', kind: 'dir', children: [child],
    }
    mount([directory])
    const root = data[0]
    const request = requestDeletion(mode, 'Folder')!
    await act(async () => request.onConfirm())

    expect(mode === 'permanent' ? deleteNode : trashNode).toHaveBeenCalledExactlyOnceWith(directory)
    expect(deleteCache).toHaveBeenCalledExactlyOnceWith('/workspace/folder')
    expect(files.has('folder')).toBe(false)
    expect(files.has('child')).toBe(false)
    expect(files.get('root')).toBe(root)
    expect(data).toEqual([{ ...root, children: [] }])
  })

  it.each(['permanent', 'trash'] as const)('keeps the legacy confirmation callback compatible for %s', async (mode) => {
    const source = file()
    mount([source], { legacy: true })
    requestDeletion(mode)

    expect(onRequestDelete).not.toHaveBeenCalled()
    expect(onShowConfirm).toHaveBeenCalledOnce()
    expect(onShowConfirm.mock.lastCall![0].title).toBe(mode === 'permanent'
      ? 'Are you sure you want to delete source.md?'
      : 'Are you sure you want to move source.md to trash?')
    expect(deleteNode).not.toHaveBeenCalled()
    expect(trashNode).not.toHaveBeenCalled()
    await act(async () => onShowConfirm.mock.lastCall![0].onConfirm())
    expect(mode === 'permanent' ? deleteNode : trashNode).toHaveBeenCalledExactlyOnceWith(source)
    expect(new SimpleTree(data).find('source')).toBeNull()
  })

  it.each([false, true])('does not offer deletion for the workspace root with stickyRoot=%s', async (stickyRoot) => {
    mount([file()], { stickyRoot })
    const root = data[0]
    if (stickyRoot) {
      act(() => fileTreeHandler.rootTree!.props.onScroll!({
        scrollDirection: 'forward', scrollOffset: 40, scrollUpdateWasRequested: false,
      }))
    }
    const rootRow = document.querySelector(stickyRoot
      ? '[data-mf-file-tree-sticky-root="true"]'
      : '[data-mf-file-tree-root="true"]')!
    fireEvent.contextMenu(rootRow, { clientX: 40, clientY: 20 })
    const menuValues = onShowContextMenu.mock.lastCall![0].items.map((item) => item.value)

    expect(menuValues).not.toContain('delete_folder')
    expect(menuValues).not.toContain('delete_file')
    expect(menuValues).not.toContain('trash')
    expect(onRequestDelete).not.toHaveBeenCalled()
    expect(onShowConfirm).not.toHaveBeenCalled()
    expect(fileSystem.runFileMutation).not.toHaveBeenCalled()
    expect(deleteNode).not.toHaveBeenCalled()
    expect(trashNode).not.toHaveBeenCalled()
    expect(deleteCache).not.toHaveBeenCalled()
    expect(files.get('root')).toBe(root)
    expect(files.has('source')).toBe(true)
    expect(data).toEqual([root])
  })
})
