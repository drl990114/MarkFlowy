import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode, useState, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'zens'
import type * as Zens from 'zens'
import FileTree from '../../../../../packages/interface/src/components/FileTree/FileTree'
import { SimpleTree } from '../../../../../packages/interface/src/components/FileTree/types'
import { AppContext } from '../../../../../packages/interface/src/contexts/AppContext'
import {
  FileSystemContext,
  type FileSystemContextValue,
} from '../../../../../packages/interface/src/contexts/FileSystemContext'
import { FileTreeContext } from '../../../../../packages/interface/src/contexts/FileTreeContext'
import type { IFile } from '../../../../../packages/interface/src/types/file'
import { ContextMenu, hideContextMenu, showContextMenu } from '../ui-v2/ContextMenu'
import { Container } from './styles'

vi.mock('@/commands', () => ({
  commandRegistry: { execute: vi.fn() },
  keybindingRegistry: { formatKeybinding: vi.fn() },
}))
vi.mock('@markflowy/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('zens', async (importOriginal) => ({
  ...(await importOriginal<typeof Zens>()),
  toast: { success: vi.fn(), error: vi.fn() },
}))

const picker = vi.fn<NonNullable<FileSystemContextValue['selectCopyDirectory']>>()
const copyText = vi.fn()
const onSelect = vi.fn()
const fileSystem: FileSystemContextValue = {
  runFileMutation: (operation) => operation({ protectFileIds: vi.fn(), protectPaths: vi.fn() }),
  copyFile: vi.fn(),
  selectCopyDirectory: picker,
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
  getMdRelativePath: vi.fn(async (path) => path.replace('/workspace/', '')),
  createFolder: vi.fn(),
  renameFile: vi.fn(),
}

const source: IFile = {
  id: 'source',
  name: 'note.md',
  kind: 'file',
  ext: 'md',
  path: '/workspace/note.md',
  content: '# Unsaved edits',
}
const copiedFile: IFile = {
  id: 'copied',
  name: 'note.md',
  kind: 'file',
  ext: 'md',
  path: '/workspace/archive/note.md',
}
const sibling: IFile = {
  id: 'sibling',
  name: 'existing.md',
  kind: 'file',
  path: '/workspace/archive/existing.md',
}

function FillFlexParent({
  children,
}: {
  children: (dimensions: { width: number; height: number }) => ReactNode
}) {
  return children({ width: 340, height: 300 })
}

function Harness() {
  const [data, setData] = useState<IFile[]>([
    {
      id: 'root',
      name: 'Workspace',
      kind: 'dir',
      path: '/workspace',
      children: [
        { id: 'archive', name: 'Archive', path: '/workspace/archive', kind: 'dir', children: [] },
        { ...source },
      ],
    },
  ])
  return (
    <ThemeProvider theme={desktopLightTheme}>
      <AppContext.Provider value={{ copyText }}>
        <FileSystemContext.Provider value={fileSystem}>
          <FileTreeContext.Provider
            value={{
              folderData: data,
              setFolderData: setData,
              setFolderDataPure: setData,
              deleteNode: vi.fn(),
              trashNode: vi.fn(),
              getRootPath: () => '/workspace',
              refreshFolder: vi.fn(),
            }}
          >
            <Container>
              <FileTree
                data={data}
                disableDrag
                fillFlexParentComponent={FillFlexParent}
                getFileObject={(id) => new SimpleTree(data).find(id)?.data}
                getFileObjectByPath={() => undefined}
                createFile={(file) => ({ ...file, id: 'copy-created' }) as IFile}
                onSelect={onSelect}
                onShowConfirm={vi.fn()}
                onShowContextMenu={showContextMenu}
                rowHeight={26}
              />
            </Container>
            <ContextMenu />
          </FileTreeContext.Provider>
        </FileSystemContext.Provider>
      </AppContext.Provider>
    </ThemeProvider>
  )
}

async function openMenu(name = 'note.md') {
  fireEvent.contextMenu(screen.getAllByText(name)[0], { clientX: 80, clientY: 40 })
  await screen.findByRole('menuitem', { name: 'contextmenu.explorer.copy_path' })
}

async function chooseCopy(action: 'duplicate_file' | 'copy_to') {
  await openMenu()
  onSelect.mockClear()
  fireEvent.click(screen.getByRole('menuitem', { name: `contextmenu.explorer.${action}` }))
  await waitFor(() => expect(fileSystem.copyFile).toHaveBeenCalledOnce())
}

beforeEach(() => {
  vi.clearAllMocks()
  fileSystem.selectCopyDirectory = picker
  picker.mockResolvedValue('/workspace/archive')
  vi.mocked(fileSystem.copyFile).mockResolvedValue('/workspace/note copy.md')
  vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([])
})

afterEach(async () => {
  act(() => hideContextMenu())
  cleanup()
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40))
  })
})

describe('FileTree copy menu integration', () => {
  it('separates file actions from the path submenu and preserves both path copy commands', async () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    )
    await openMenu()
    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent)
    expect(labels.slice(0, 5)).toEqual([
      'contextmenu.explorer.new',
      'contextmenu.explorer.rename',
      'contextmenu.explorer.duplicate_file',
      'contextmenu.explorer.copy_to',
      'contextmenu.explorer.copy_path',
    ])
    const paths = screen.getByRole('menuitem', { name: 'contextmenu.explorer.copy_path' })
    act(() => paths.focus())
    fireEvent.keyDown(paths, { key: 'ArrowRight' })
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'contextmenu.explorer.relative_path' }),
    )
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('note.md'))
    expect(fileSystem.copyFile).not.toHaveBeenCalled()

    await openMenu()
    const secondPaths = screen.getByRole('menuitem', { name: 'contextmenu.explorer.copy_path' })
    act(() => secondPaths.focus())
    fireEvent.keyDown(secondPaths, { key: 'ArrowRight' })
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'contextmenu.explorer.absolute_path' }),
    )
    await waitFor(() => expect(copyText).toHaveBeenCalledWith('/workspace/note.md'))
  })

  it('creates a visible sibling after the real menu closes without opening it or saving the source', async () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    )
    await chooseCopy('duplicate_file')
    expect(await screen.findByText('note copy.md')).toBeTruthy()
    expect(fileSystem.copyFile).toHaveBeenCalledWith('/workspace/note.md', undefined)
    expect(picker).not.toHaveBeenCalled()
    expect(onSelect).not.toHaveBeenCalled()
    expect(fileSystem.writeFile).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(toast.success).toHaveBeenCalledWith('contextmenu.explorer.duplicate_success')
  })

  it('leaves an unloaded destination intact and discovers the copy alongside existing files on expansion', async () => {
    vi.mocked(fileSystem.copyFile).mockResolvedValue(copiedFile.path!)
    vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([sibling, copiedFile])
    render(<Harness />)
    await chooseCopy('copy_to')
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalled()
    expect(screen.getAllByText('note.md')).toHaveLength(1)
    fireEvent.click(screen.getByText('Archive'))
    expect(await screen.findByText('existing.md')).toBeTruthy()
    expect(screen.getAllByText('note.md')).toHaveLength(2)
    expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce()
  })

  it('updates a previously loaded empty destination while it is collapsed', async () => {
    vi.mocked(fileSystem.copyFile).mockResolvedValue(copiedFile.path!)
    render(<Harness />)
    fireEvent.click(screen.getByText('Archive'))
    await waitFor(() => expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce())
    await screen.findByText('file.emptyFolder')
    fireEvent.click(screen.getByText('Archive'))
    await chooseCopy('copy_to')
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    fireEvent.click(screen.getByText('Archive'))
    await waitFor(() => expect(screen.getAllByText('note.md')).toHaveLength(2))
    expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce()
  })

  it('merges an older in-flight directory read without losing or duplicating the completed copy', async () => {
    let resolveRead!: (files: IFile[]) => void
    vi.mocked(fileSystem.readSubdirectory).mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve
      }),
    )
    vi.mocked(fileSystem.copyFile).mockResolvedValue(copiedFile.path!)
    render(<Harness />)
    fireEvent.click(screen.getByText('Archive'))
    await waitFor(() => expect(fileSystem.readSubdirectory).toHaveBeenCalledOnce())
    await chooseCopy('copy_to')
    await waitFor(() => expect(screen.getAllByText('note.md')).toHaveLength(2))
    await act(async () => resolveRead([sibling]))
    expect(await screen.findByText('existing.md')).toBeTruthy()
    expect(screen.getAllByText('note.md')).toHaveLength(2)
  })

  it('shows an error without inserting a failed copy', async () => {
    vi.mocked(fileSystem.copyFile).mockRejectedValue(new Error('Permission denied'))
    render(<Harness />)
    await chooseCopy('duplicate_file')
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('contextmenu.explorer.copy_failed'),
    )
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.queryByText('note copy.md')).toBeNull()
  })

  it('hides unsupported copy-to and excludes file copy actions from folder menus', async () => {
    delete fileSystem.selectCopyDirectory
    render(<Harness />)
    await openMenu()
    expect(screen.queryByRole('menuitem', { name: 'contextmenu.explorer.copy_to' })).toBeNull()
    expect(
      screen.getByRole('menuitem', { name: 'contextmenu.explorer.duplicate_file' }),
    ).toBeTruthy()
    act(() => hideContextMenu())
    await waitFor(() => expect(screen.queryByRole('menuitem')).toBeNull())
    await openMenu('Archive')
    expect(
      screen.queryByRole('menuitem', { name: 'contextmenu.explorer.duplicate_file' }),
    ).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'contextmenu.explorer.copy_to' })).toBeNull()
  })
})
