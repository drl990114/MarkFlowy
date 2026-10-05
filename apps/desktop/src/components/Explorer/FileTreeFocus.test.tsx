import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode, useState, type MouseEventHandler, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FileTree, {
  fileTreeHandler,
} from '../../../../../packages/interface/src/components/FileTree/FileTree'
import { SimpleTree } from '../../../../../packages/interface/src/components/FileTree/types'
import {
  FileSystemContext,
  type FileSystemContextValue,
} from '../../../../../packages/interface/src/contexts/FileSystemContext'
import { FileTreeContext } from '../../../../../packages/interface/src/contexts/FileTreeContext'
import type { IFile } from '../../../../../packages/interface/src/types/file'
import { Button } from '../ui/button'

vi.mock('@markflowy/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const fileSystem: FileSystemContextValue = {
  runFileMutation: (operation) => operation({ protectFileIds: vi.fn(), protectPaths: vi.fn() }),
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

const activeFile: IFile = {
  id: 'active',
  kind: 'file',
  name: 'Active.md',
  path: '/workspace/docs/nested/Active.md',
}

function FillFlexParent({
  children,
}: {
  children: (dimensions: { width: number; height: number }) => ReactNode
}) {
  return children({ width: 300, height: 156 })
}

function ActionButton({
  onClick,
  tooltipProps,
}: {
  onClick: MouseEventHandler<HTMLButtonElement>
  tooltipProps: { title: string }
}) {
  return <Button onClick={onClick}>{tooltipProps.title}</Button>
}

function Harness({
  active = activeFile,
  initialChildren = [],
  rootPath = '/workspace',
  onSelect = vi.fn(),
  onPathsChange = vi.fn(),
}: {
  active?: IFile | null
  initialChildren?: IFile[]
  rootPath?: string
  onSelect?: (file: IFile) => void
  onPathsChange?: (paths: string[]) => void
}) {
  const [data, setData] = useState<IFile[]>([
    { id: 'root', kind: 'dir', name: 'Workspace', path: rootPath, children: initialChildren },
  ])
  const [expandedPaths, setExpandedPaths] = useState([rootPath])

  return (
    <ThemeProvider theme={desktopLightTheme}>
      <FileSystemContext.Provider value={fileSystem}>
        <FileTreeContext.Provider
          value={{
            activeId: active?.id,
            folderData: data,
            setFolderData: setData,
            setFolderDataPure: setData,
            deleteNode: vi.fn(),
            trashNode: vi.fn(),
            getRootPath: () => rootPath,
            refreshFolder: vi.fn(),
          }}
        >
          <FileTree
            data={data}
            expandedPaths={expandedPaths}
            onExpandedPathsChange={(paths) => {
              setExpandedPaths(paths)
              onPathsChange(paths)
            }}
            disableDrag
            fillFlexParentComponent={FillFlexParent}
            getFileObject={(id) =>
              new SimpleTree(data).find(id)?.data ?? (active?.id === id ? active : undefined)
            }
            getFileObjectByPath={() => undefined}
            iconButtonComponent={ActionButton}
            onSelect={onSelect}
            onShowConfirm={vi.fn()}
            onShowContextMenu={vi.fn()}
            rowHeight={26}
            stickyRoot
          />
        </FileTreeContext.Provider>
      </FileSystemContext.Provider>
    </ThemeProvider>
  )
}

function directory(id: string, path: string, children: IFile[] = []): IFile {
  return { id, name: id, kind: 'dir', path, children }
}

function clickRootAction(name: string) {
  const pinnedRoot = document.querySelector<HTMLElement>('[data-mf-file-tree-sticky-layer]')
  const button = (pinnedRoot ? within(pinnedRoot) : screen).getByRole('button', { name })
  act(() => button.focus())
  fireEvent.click(button)
}

async function expectActiveRow() {
  await waitFor(() => {
    const row = screen.getByText(activeFile.name).closest('[role="treeitem"]')
    expect(row?.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(row)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([])
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('FileTree Focus Active File', () => {
  it('reveals and focuses the active file after Collapse All without an adapter scroll callback', async () => {
    const onPathsChange = vi.fn()
    render(
      <StrictMode>
        <Harness
          initialChildren={[
            directory('docs', '/workspace/docs', [
              directory('nested', '/workspace/docs/nested', [{ ...activeFile }]),
            ]),
            directory('other', '/workspace/other'),
          ]}
          onPathsChange={onPathsChange}
        />
      </StrictMode>,
    )
    await screen.findByText(activeFile.name)
    clickRootAction('Collapse All')
    expect(screen.queryByText(activeFile.name)).toBeNull()

    clickRootAction('Focus Active File')

    await expectActiveRow()
    expect(fileTreeHandler.rootTree?.isOpen('other')).toBe(false)
    expect(onPathsChange.mock.lastCall?.[0].sort()).toEqual([
      '/workspace', '/workspace/docs', '/workspace/docs/nested',
    ])
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalled()
  })

  it('scrolls from the pinned root back to an offscreen active file', async () => {
    const files = Array.from({ length: 40 }, (_, index): IFile => ({
      id: `file-${index}`,
      kind: 'file',
      name: `${index}.md`,
      path: `/workspace/${index}.md`,
    }))
    render(<Harness initialChildren={[{ ...activeFile }, ...files]} />)
    await act(async () => { await fileTreeHandler.rootTree?.scrollTo('file-39', 'end') })
    expect(document.querySelector('[data-mf-file-tree-sticky-layer]')).not.toBeNull()
    expect(screen.queryByText(activeFile.name)).toBeNull()

    clickRootAction('Focus Active File')

    await expectActiveRow()
    expect(fileTreeHandler.rootTree?.isOpen('root')).toBe(true)
  })

  it('loads only the active file ancestry before selecting the file', async () => {
    vi.mocked(fileSystem.readSubdirectory).mockImplementation(async (path) => {
      if (path === '/workspace/docs') return [directory('nested', '/workspace/docs/nested')]
      if (path === '/workspace/docs/nested') return [{ ...activeFile }]
      return []
    })
    const onSelect = vi.fn()
    render(
      <Harness
        initialChildren={[directory('docs', '/workspace/docs'), directory('other', '/workspace/other')]}
        onSelect={onSelect}
      />,
    )
    clickRootAction('Focus Active File')

    await expectActiveRow()
    expect(fileSystem.readSubdirectory).toHaveBeenCalledTimes(2)
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalledWith('/workspace/other')
    expect(onSelect).toHaveBeenLastCalledWith(activeFile)
  })

  it('shares an in-flight directory read across repeated clicks and focuses only once', async () => {
    let resolve!: (files: IFile[]) => void
    vi.mocked(fileSystem.readSubdirectory).mockReturnValue(new Promise((done) => { resolve = done }))
    const onSelect = vi.fn()
    render(<Harness initialChildren={[directory('docs', '/workspace/docs')]} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('docs'))
    await waitFor(() => expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce())
    onSelect.mockClear()

    clickRootAction('Focus Active File')
    clickRootAction('Focus Active File')
    await act(async () => resolve([
      directory('nested', '/workspace/docs/nested', [{ ...activeFile }]),
    ]))

    await expectActiveRow()
    expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(activeFile)
  })

  it('stops revealing the previous file when the active editor changes during a read', async () => {
    let resolve!: (files: IFile[]) => void
    vi.mocked(fileSystem.readSubdirectory).mockReturnValue(new Promise((done) => { resolve = done }))
    const other: IFile = { id: 'other', kind: 'file', name: 'Other.md', path: '/workspace/Other.md' }
    const onSelect = vi.fn()
    const view = render(
      <Harness initialChildren={[directory('docs', '/workspace/docs'), other]} onSelect={onSelect} />,
    )
    clickRootAction('Focus Active File')
    await waitFor(() => expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce())

    view.rerender(<Harness active={other} onSelect={onSelect} />)
    onSelect.mockClear()
    await act(async () => resolve([directory('nested', '/workspace/docs/nested')]))

    expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce()
    expect(fileTreeHandler.rootTree?.isOpen('nested')).toBe(false)
    expect(fileTreeHandler.rootTree?.isSelected(other.id)).toBe(true)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('discards a pending reveal after switching workspaces', async () => {
    let resolve!: (files: IFile[]) => void
    vi.mocked(fileSystem.readSubdirectory).mockReturnValue(new Promise((done) => { resolve = done }))
    const view = render(<Harness key='first' initialChildren={[directory('docs', '/workspace/docs')]} />)
    clickRootAction('Focus Active File')
    await waitFor(() => expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce())

    view.rerender(
      <Harness key='next' active={null} rootPath='/next' initialChildren={[directory('keep', '/next/keep')]} />,
    )
    const select = vi.spyOn(fileTreeHandler.rootTree!, 'select')
    await act(async () => resolve([directory('nested', '/workspace/docs/nested', [{ ...activeFile }])]))

    expect(select).not.toHaveBeenCalled()
    expect(screen.queryByText(activeFile.name)).toBeNull()
    expect(screen.getByText('keep')).toBeTruthy()
    expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce()
  })

  it('can retry a failed directory read on the next explicit click', async () => {
    const error = new Error('Read failed')
    const logError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(fileSystem.readSubdirectory)
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce([directory('nested', '/workspace/docs/nested', [{ ...activeFile }])])
    render(<Harness initialChildren={[directory('docs', '/workspace/docs')]} />)
    clickRootAction('Focus Active File')
    await waitFor(() => expect(logError).toHaveBeenCalledWith('Failed to load subdirectory:', error))
    expect(screen.queryByText(activeFile.name)).toBeNull()

    clickRootAction('Focus Active File')

    await expectActiveRow()
    expect(fileSystem.readSubdirectory).toHaveBeenCalledTimes(2)
  })

  it('resolves Windows paths without confusing directory prefixes or casing', async () => {
    const file = { ...activeFile, path: 'C:/WORKSPACE/docs/Active.md' }
    vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([{ ...file }])
    render(
      <Harness
        active={file}
        rootPath={'c:\\workspace'}
        initialChildren={[
          directory('doc', 'c:\\workspace\\doc'),
          directory('docs', 'c:\\workspace\\docs'),
        ]}
      />,
    )
    clickRootAction('Focus Active File')

    await expectActiveRow()
    expect(fileSystem.readSubdirectory).toHaveBeenCalledExactlyOnceWith('c:\\workspace\\docs')
    expect(fileTreeHandler.rootTree?.isOpen('doc')).toBe(false)
  })

  it.each([
    null,
    { ...activeFile, path: undefined },
    { ...activeFile, path: '/workspace-other/Active.md' },
  ])('does not change the tree for a file outside the workspace: %j', (active) => {
    render(<Harness active={active} initialChildren={[directory('docs', '/workspace/docs')]} />)
    const select = vi.spyOn(fileTreeHandler.rootTree!, 'select')
    clickRootAction('Focus Active File')
    expect(select).not.toHaveBeenCalled()
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalled()
    expect(fileTreeHandler.rootTree?.isOpen('docs')).toBe(false)
  })
})
