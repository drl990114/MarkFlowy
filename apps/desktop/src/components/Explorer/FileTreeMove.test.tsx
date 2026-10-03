import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Zens from 'zens'
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
}))

const fileSystem: FileSystemContextValue = {
  runFileMutation: vi.fn((operation) => operation({ protectFileIds: vi.fn(), protectPaths: vi.fn() })),
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
  pathJoin: vi.fn(async (parent, name) => `${parent}/${name}`),
  getPathName: vi.fn(),
  getFileContent: vi.fn(),
  getMdRelativePath: vi.fn(),
  createFolder: vi.fn(),
  renameFile: vi.fn(),
  copyFile: vi.fn(),
}
const onShowConfirm = vi.fn<FileTreeProps['onShowConfirm']>()
const onBeforeReplace = vi.fn<NonNullable<FileTreeProps['onBeforeReplace']>>()
const onSelect = vi.fn()
const files = new Map<string, IFile>()
let data: IFile[]
let replaceData: (next: IFile[]) => void

function indexFiles(nodes: IFile[]) {
  for (const node of nodes) {
    files.set(node.id, node)
    if (node.children) indexFiles(node.children)
  }
}

function file(id: string, name = `${id}.md`, parent = '/workspace'): IFile {
  return { id, name, path: `${parent}/${name}`, kind: 'file' }
}

function folder(id: string, children: IFile[] = []): IFile {
  return { id, name: id, path: `/workspace/${id}`, kind: 'dir', children }
}

function FillFlexParent({ children }: {
  children: (dimensions: { width: number; height: number }) => ReactNode
}) {
  return children({ width: 340, height: 650 })
}

function Harness({ initial, activeId }: { initial: IFile[]; activeId?: string }) {
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
          activeId,
          folderData: state,
          setFolderData: replaceData,
          setFolderDataPure: replaceData,
          deleteNode: vi.fn(),
          trashNode: vi.fn(),
          getRootPath: () => state[0]?.path,
          refreshFolder: vi.fn(),
        }}>
          <FileTree
            data={state}
            fillFlexParentComponent={FillFlexParent}
            getFileObject={(id) => files.get(id)}
            getFileObjectByPath={(path) => [...files.values()].find((entry) => entry.path === path)}
            setFileObject={(id, entry) => files.set(id, entry)}
            setFileObjectByPath={(_path, entry) => files.set(entry.id, entry)}
            deleteFileObjectsByIds={(ids) => ids.forEach((id) => files.delete(id))}
            onBeforeReplace={onBeforeReplace}
            onSelect={onSelect}
            onShowConfirm={onShowConfirm}
            onShowContextMenu={vi.fn()}
          />
        </FileTreeContext.Provider>
      </FileSystemContext.Provider>
    </ThemeProvider>
  )
}

function mount(children: IFile[], activeId?: string) {
  const initial: IFile[] = [{
    id: 'root', name: 'Workspace', path: '/workspace', kind: 'dir', children,
  }]
  indexFiles(initial)
  return render(<Harness initial={initial} activeId={activeId} />)
}

function childrenOf(id = 'target') {
  return new SimpleTree(data).find(id)?.data.children ?? []
}

// Drive Arborist's actual drop callback with its live NodeApi objects. Rendering,
// expansion, selection and inline editing still use the real tree component.
async function drop(ids: string[], index: number, parentId = 'target') {
  const api = fileTreeHandler.rootTree!
  await act(async () => {
    await api.props.onMove?.({
      dragIds: ids,
      dragNodes: ids.map((id) => api.get(id)!),
      parentId,
      parentNode: api.get(parentId),
      index,
    })
  })
}

async function confirmMove() {
  await act(async () => onShowConfirm.mock.lastCall![0].onConfirm())
}

async function finishMove() {
  await act(async () => {
    await vi.mocked(fileSystem.runFileMutation).mock.results.at(-1)?.value
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

beforeEach(() => {
  vi.clearAllMocks()
  files.clear()
  vi.mocked(fileSystem.fileExists).mockResolvedValue(false)
  vi.mocked(fileSystem.readSubdirectory).mockReset().mockResolvedValue([])
  vi.mocked(fileSystem.moveFilesToTargetFolder).mockImplementation(async ({ files: paths, targetFolder }) =>
    paths.map((path) => ({
      old_path: path,
      new_path: `${targetFolder}/${path.split('/').at(-1)}`,
      is_folder: [...files.values()].find((entry) => entry.path === path)?.kind === 'dir',
      children: null,
    })),
  )
  onBeforeReplace.mockResolvedValue({ allowed: true, targetIds: [] })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('FileTree move ordering', () => {
  it.each([0, 2, 20])('uses directory order instead of drop slot %i and preserves active content', async (index) => {
    const source = { ...file('source', 'note2.md'), content: 'unsaved text' }
    const first = file('first', 'note1.md', '/workspace/target')
    const last = file('last', 'note10.md', '/workspace/target')
    const directory = { ...folder('nested'), path: '/workspace/target/nested' }
    const reopened = [directory, first, { ...source, id: 'read-source', path: '/workspace/target/note2.md' }, last]
    vi.mocked(fileSystem.readSubdirectory).mockResolvedValue(reopened)
    mount([folder('target', [directory, first, last]), source], source.id)
    fireEvent.click(screen.getByText('target'))
    fireEvent.click(screen.getByText('note2.md'))
    expect(fileTreeHandler.rootTree?.isSelected('source')).toBe(true)
    await drop(['source'], index)
    await confirmMove()
    await finishMove()

    expect(childrenOf().map((entry) => entry.name)).toEqual(reopened.map((entry) => entry.name))
    expect(fileSystem.readSubdirectory).toHaveBeenCalledExactlyOnceWith('/workspace/target')
    expect(childrenOf()[2]).toMatchObject({ id: 'source', content: 'unsaved text' })
    expect(files.get('source')?.path).toBe('/workspace/target/note2.md')
    expect(fileTreeHandler.rootTree?.isSelected('source')).toBe(true)
    const labels = [...document.querySelectorAll('[role="treeitem"]')].map((row) => row.textContent)
    expect(labels.findIndex((text) => text?.includes('note2.md'))).toBeLessThan(
      labels.findIndex((text) => text?.includes('note10.md')),
    )
  })

  it('reads once for a batch, follows case/Unicode order and preserves moved subtrees', async () => {
    const leaf = file('leaf', 'edited.md', '/workspace/资料')
    const movedFolder = { ...folder('资料', [leaf]), path: '/workspace/资料' }
    const sources = [file('lower', 'a.md'), file('upper', 'A.md'), file('chinese', '中文.md')]
    vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([
      { ...movedFolder, path: '/workspace/target/资料', children: [] },
      ...[sources[1], sources[0], sources[2]].map((entry) => ({ ...entry, path: `/workspace/target/${entry.name}` })),
    ])
    mount([folder('target'), movedFolder, ...sources])
    fireEvent.click(screen.getByText('资料'))
    await drop(['chinese', 'lower', '资料', 'upper'], 0)
    await confirmMove()
    await finishMove()
    expect(childrenOf().map((entry) => entry.name)).toEqual(['资料', 'A.md', 'a.md', '中文.md'])
    expect(childrenOf()[0].children?.[0]).toMatchObject({ id: 'leaf', path: '/workspace/target/资料/edited.md' })
    expect(fileTreeHandler.rootTree?.isOpen('资料')).toBe(true)
    expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce()
  })

  it('loads existing siblings of an unopened destination and leaves unrelated empty folders cached', async () => {
    const source = file('source')
    const sibling = file('existing', 'a.md', '/workspace/target')
    mount([folder('target'), folder('empty'), source])
    fireEvent.click(screen.getByText('empty'))
    await waitFor(() => expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce())
    fireEvent.click(screen.getByText('empty'))
    vi.mocked(fileSystem.readSubdirectory).mockClear().mockResolvedValue([
      sibling, { ...source, path: '/workspace/target/source.md' },
    ])
    await drop(['source'], 0)
    await confirmMove()
    await finishMove()
    fireEvent.click(screen.getByText('target'))
    fireEvent.click(screen.getByText('empty'))
    expect(await screen.findByText('a.md')).toBeTruthy()
    expect(fileSystem.readSubdirectory).toHaveBeenCalledExactlyOnceWith('/workspace/target')
    expect(childrenOf().map((entry) => entry.id)).toEqual(['existing', 'source'])
  })

  it('preserves a draft and updates to another directory made during the refresh', async () => {
    const read = deferred<IFile[]>()
    const source = file('source')
    const sibling = file('sibling', 'a.md', '/workspace/target')
    vi.mocked(fileSystem.readSubdirectory).mockReturnValue(read.promise)
    mount([folder('target', [sibling]), folder('other'), source])
    fireEvent.click(screen.getByText('target'))
    await drop(['source'], 0)
    await confirmMove()
    const draft: IFile = { id: 'draft', name: '', kind: 'pending_new_file' }
    await act(async () => {
      const next = new SimpleTree(data)
      next.create({ parentId: 'target', index: 0, data: draft })
      next.create({ parentId: 'other', data: file('new', 'new.md', '/workspace/other') })
      replaceData(next.data)
    })
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '正在输入' } })
    await act(async () => read.resolve([sibling, { ...source, path: '/workspace/target/source.md' }]))
    await finishMove()
    expect(childrenOf()[0]).toBe(draft)
    expect(screen.getByRole('textbox')).toBe(input)
    expect((input as HTMLInputElement).value).toBe('正在输入')
    expect(childrenOf('other').map((entry) => entry.id)).toEqual(['new'])
    expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce()
  })

  it('merges into the latest tree when a lazy read completes during the backend move', async () => {
    const move = deferred<Awaited<ReturnType<FileSystemContextValue['moveFilesToTargetFolder']>>>()
    const source = file('source')
    const sibling = file('sibling', 'a.md', '/workspace/target')
    vi.mocked(fileSystem.moveFilesToTargetFolder).mockReturnValue(move.promise)
    vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([
      sibling, { ...source, path: '/workspace/target/source.md' },
    ])
    mount([folder('target'), folder('other'), source])
    await drop(['source'], 0)
    await confirmMove()
    await act(async () => replaceData(data.map((root) => ({
      ...root,
      children: root.children?.map((entry) => entry.id === 'other'
        ? { ...entry, children: [file('loaded', 'loaded.md', '/workspace/other')] }
        : entry),
    }))))
    await act(async () => move.resolve([{
      old_path: source.path!, new_path: '/workspace/target/source.md', is_folder: false, children: null,
    }]))
    await finishMove()
    expect(childrenOf('other').map((entry) => entry.id)).toEqual(['loaded'])
    expect(childrenOf().map((entry) => entry.id)).toEqual(['sibling', 'source'])
  })

  it.each(['before', 'after'])('discards a pre-move read resolving %s the refresh', async (timing) => {
    const oldRead = deferred<IFile[]>()
    const newRead = deferred<IFile[]>()
    const source = file('source')
    const sibling = file('sibling', 'a.md', '/workspace/target')
    vi.mocked(fileSystem.readSubdirectory)
      .mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise)
    mount([folder('target'), source])
    fireEvent.click(screen.getByText('target'))
    await waitFor(() => expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce())
    await drop(['source'], 0)
    await confirmMove()
    const resolveOld = () => oldRead.resolve([file('stale', 'deleted.md', '/workspace/target')])
    if (timing === 'before') await act(async () => resolveOld())
    await act(async () => newRead.resolve([sibling, { ...source, path: '/workspace/target/source.md' }]))
    await finishMove()
    if (timing === 'after') await act(async () => resolveOld())
    expect(childrenOf().map((entry) => entry.id)).toEqual(['sibling', 'source'])
    expect(fileSystem.readSubdirectory).toHaveBeenCalledTimes(2)
  })

  it('keeps a successful move after a read failure and retries on the next expansion', async () => {
    const source = file('source')
    const sibling = file('sibling', 'a.md', '/workspace/target')
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(fileSystem.readSubdirectory).mockRejectedValueOnce(new Error('Read denied'))
    mount([folder('target'), source])
    await drop(['source'], 0)
    await confirmMove()
    await finishMove()
    expect(childrenOf().map((entry) => entry.id)).toEqual(['source'])
    expect(childrenOf('root').some((entry) => entry.id === 'source')).toBe(false)
    expect(error).toHaveBeenCalledOnce()
    vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([
      sibling, { ...source, path: '/workspace/target/source.md' },
    ])
    fireEvent.click(screen.getByText('target'))
    await screen.findByText('a.md')
    expect(childrenOf().map((entry) => entry.id)).toEqual(['sibling', 'source'])
    expect(fileSystem.moveFilesToTargetFolder).toHaveBeenCalledOnce()
    expect(fileSystem.readSubdirectory).toHaveBeenCalledTimes(2)
  })

  it('does not apply a refresh after switching workspaces', async () => {
    const read = deferred<IFile[]>()
    const source = file('source')
    vi.mocked(fileSystem.readSubdirectory).mockReturnValue(read.promise)
    mount([folder('target'), source])
    await drop(['source'], 0)
    await confirmMove()
    const nextRoot = { ...folder('next'), children: [file('next-file', 'next.md', '/workspace/next')] }
    await act(async () => replaceData([nextRoot]))
    await act(async () => read.resolve([{ ...source, path: '/workspace/target/source.md' }]))
    await finishMove()
    expect(data).toEqual([nextRoot])
    expect(await screen.findByText('next.md')).toBeTruthy()
    expect(screen.queryByText('source.md')).toBeNull()
  })

  it('keeps same-directory drops and cancelled confirmation as no-ops', async () => {
    mount([folder('target', [file('inside', 'inside.md', '/workspace/target')]), file('source')])
    fireEvent.click(screen.getByText('target'))
    await drop(['inside'], 0)
    expect(onShowConfirm).not.toHaveBeenCalled()
    await drop(['source'], 0)
    expect(onShowConfirm).toHaveBeenCalledOnce()
    expect(fileSystem.moveFilesToTargetFolder).not.toHaveBeenCalled()
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalled()
    expect(childrenOf().map((entry) => entry.id)).toEqual(['inside'])
  })

  it('preserves replacement preflight and removes the replaced ID before ordering', async () => {
    const source = file('source', 'same.md')
    const replaced = file('replaced', 'same.md', '/workspace/target')
    vi.mocked(fileSystem.fileExists).mockResolvedValue(true)
    onBeforeReplace.mockResolvedValue({ allowed: true, targetIds: ['replaced'] })
    vi.mocked(fileSystem.moveFilesToTargetFolder).mockResolvedValue([
      { old_path: replaced.path!, new_path: '', is_folder: false, is_replaced: true, children: null },
      { old_path: source.path!, new_path: replaced.path!, is_folder: false, children: null },
    ])
    vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([{ ...source, path: replaced.path }])
    mount([folder('target', [replaced]), source])
    await drop(['source'], 0)
    await confirmMove()
    await finishMove()
    expect(onBeforeReplace).toHaveBeenCalledWith(replaced.path)
    expect(fileSystem.moveFilesToTargetFolder).toHaveBeenCalledWith({
      files: [source.path], targetFolder: '/workspace/target', replaceExist: true,
    })
    expect(childrenOf().map((entry) => entry.id)).toEqual(['source'])
    expect(files.has('replaced')).toBe(false)
  })

  it('does not move or read when replacement preflight rejects the operation', async () => {
    mount([folder('target', [file('existing', 'source.md', '/workspace/target')]), file('source')])
    vi.mocked(fileSystem.fileExists).mockResolvedValue(true)
    onBeforeReplace.mockResolvedValue({ allowed: false, targetIds: ['existing'] })
    await drop(['source'], 0)
    await confirmMove()
    await finishMove()
    expect(fileSystem.moveFilesToTargetFolder).not.toHaveBeenCalled()
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalled()
    expect(childrenOf().map((entry) => entry.id)).toEqual(['existing'])
  })

  it('only inserts confirmed successful moves from a partial batch', async () => {
    const source = file('source')
    mount([folder('target'), source, file('remaining')])
    vi.mocked(fileSystem.moveFilesToTargetFolder).mockResolvedValue([{
      old_path: source.path!, new_path: '/workspace/target/source.md', is_folder: false, children: null,
    }])
    vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([{ ...source, path: '/workspace/target/source.md' }])
    await drop(['source', 'remaining'], 0)
    await confirmMove()
    await finishMove()
    expect(childrenOf().map((entry) => entry.id)).toEqual(['source'])
    expect(childrenOf('root').map((entry) => entry.id)).toEqual(['target', 'remaining'])
    expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce()
  })
})
