import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { StrictMode, useState, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Zens from 'zens'
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
import { ContextMenu, hideContextMenu, showContextMenu } from '../ui-v2/ContextMenu'
import { Container } from './styles'

vi.mock('@/commands', () => ({
  commandRegistry: { execute: vi.fn() },
  keybindingRegistry: { formatKeybinding: vi.fn() },
}))

vi.mock('@markflowy/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

vi.mock('zens', async (importOriginal) => {
  const original = await importOriginal<typeof Zens>()
  // Exercise the input source, without depending on stale generated CommonJS output.
  const { default: Input } = await import('../../../../../packages/zens/src/Input')
  return { ...original, Input }
})

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
  pathJoin: vi.fn(async (parent, name) => `${parent}/${name}`),
  getPathName: vi.fn(),
  getFileContent: vi.fn(),
  getMdRelativePath: vi.fn(),
  createFolder: vi.fn(),
  renameFile: vi.fn(),
  copyFile: vi.fn(),
}

function FillFlexParent({
  children,
}: {
  children: (dimensions: { width: number; height: number }) => ReactNode
}) {
  return children({ width: 300, height: 260 })
}

function Harness({
  initialChildren = [],
  initialExpandedPaths,
  onPathsChange,
}: {
  initialChildren?: IFile[]
  initialExpandedPaths?: string[]
  onPathsChange?: (paths: string[]) => void
}) {
  const [expandedPaths, setExpandedPaths] = useState(initialExpandedPaths)
  const [data, setData] = useState<IFile[]>([
    { id: 'root', kind: 'dir', name: 'Workspace', path: '/workspace', children: initialChildren },
  ])

  return (
    <ThemeProvider theme={desktopLightTheme}>
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
          <button onClick={() => setData((current) => [...current])} type='button'>
            Refresh view
          </button>
          <Container>
            <FileTree
              data={data}
              expandedPaths={expandedPaths}
              onExpandedPathsChange={
                initialExpandedPaths
                  ? (paths) => {
                      setExpandedPaths(paths)
                      onPathsChange?.(paths)
                    }
                  : undefined
              }
              disableDrag
              fillFlexParentComponent={FillFlexParent}
              getFileObject={(id) => new SimpleTree(data).find(id)?.data}
              getFileObjectByPath={() => undefined}
              onSelect={vi.fn()}
              onShowConfirm={vi.fn()}
              onShowContextMenu={showContextMenu}
              renderNodeIcon={(file) => <span data-testid={`icon-${file.kind}`} />}
              rowHeight={26}
              stickyRoot
            />
          </Container>
          <ContextMenu />
        </FileTreeContext.Provider>
      </FileSystemContext.Provider>
    </ThemeProvider>
  )
}

async function settleFocus() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 40))
  })
}

async function startCreation(kind: 'file' | 'folder', parent = 'Workspace') {
  fireEvent.contextMenu(screen.getByText(parent), { clientX: 80, clientY: 40 })
  const submenu = await screen.findByRole('menuitem', { name: 'contextmenu.explorer.new' })
  act(() => submenu.focus())
  fireEvent.keyDown(submenu, { key: 'ArrowRight' })
  fireEvent.click(await screen.findByRole('menuitem', { name: `contextmenu.explorer.add_${kind}` }))
  await settleFocus()
  const input = screen.getByRole<HTMLInputElement>('textbox')
  await settleFocus()
  return input
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([])
  vi.mocked(fileSystem.fileExists).mockResolvedValue(false)
  vi.mocked(fileSystem.writeFile).mockResolvedValue(undefined)
  vi.mocked(fileSystem.createFolder).mockResolvedValue(undefined)
})

afterEach(async () => {
  act(() => hideContextMenu())
  cleanup()
  await settleFocus()
})

describe('FileTree inline creation', () => {
  it.each(['file', 'folder'] as const)(
    'keeps a new %s focused after the real submenu closes and creates it on Enter',
    async (kind) => {
      render(
        <StrictMode>
          <Harness />
        </StrictMode>,
      )
      act(() => screen.getByRole('button', { name: 'Refresh view' }).focus())

      const input = await startCreation(kind)
      expect(document.activeElement).toBe(input)
      expect(screen.queryByRole('menu')).toBeNull()
      expect(input.hasAttribute('aria-invalid')).toBe(false)
      await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull())
      expect(
        within(input.closest('[data-mf-file-tree-node]') as HTMLElement).getByTestId(
          `icon-${kind === 'folder' ? 'dir' : 'file'}`,
        ),
      ).not.toBeNull()

      fireEvent.change(input, { target: { value: 'Notes' } })
      await waitFor(() => expect(fileSystem.fileExists).toHaveBeenCalled())
      await settleFocus()
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        if (kind === 'file') {
          expect(fileSystem.writeFile).toHaveBeenCalledWith('/workspace/Notes.md', '')
        } else {
          expect(fileSystem.createFolder).toHaveBeenCalledWith('/workspace/Notes')
        }
        expect(screen.queryByRole('textbox')).toBeNull()
      })
    },
  )

  it('preserves the same input, text and focus when the tree renders again', async () => {
    render(<Harness initialChildren={[{ id: 'pending', kind: 'pending_new_file', name: '' }]} />)
    await settleFocus()
    const input = screen.getByRole<HTMLInputElement>('textbox')
    fireEvent.change(input, { target: { value: 'Draft' } })
    await settleFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh view' }))
    await settleFocus()

    expect(screen.getByRole('textbox')).toBe(input)
    expect(input.value).toBe('Draft')
    expect(document.activeElement).toBe(input)
  })

  it('preserves the draft when a newly opened folder finishes loading', async () => {
    let resolveChildren!: (files: IFile[]) => void
    vi.mocked(fileSystem.readSubdirectory).mockReturnValue(
      new Promise((resolve) => {
        resolveChildren = resolve
      }),
    )
    render(
      <Harness
        initialChildren={[
          { id: 'folder', kind: 'dir', name: 'Folder', path: '/workspace/Folder', children: [] },
        ]}
      />,
    )
    const input = await startCreation('file', 'Folder')
    fireEvent.change(input, { target: { value: 'Draft' } })
    await settleFocus()

    await act(async () => {
      resolveChildren([
        {
          id: 'existing',
          name: 'Existing.md',
          kind: 'file',
          path: '/workspace/Folder/Existing.md',
        },
      ])
    })
    await settleFocus()

    expect(screen.getByRole('textbox')).toBe(input)
    expect(input.value).toBe('Draft')
    expect(document.activeElement).toBe(input)
    expect(screen.getByText('Existing.md')).not.toBeNull()
  })

  it.each(['file', 'folder'] as const)(
    'creates a %s from the tree background menu',
    async (kind) => {
      render(<Harness />)
      fireEvent.contextMenu(screen.getByRole('tree'), { clientX: 80, clientY: 180 })
      fireEvent.click(
        await screen.findByRole('menuitem', { name: kind === 'file' ? 'New File' : 'New Folder' }),
      )
      await settleFocus()
      await settleFocus()
      const input = screen.getByRole<HTMLInputElement>('textbox')
      expect(document.activeElement).toBe(input)
      fireEvent.change(input, { target: { value: 'Background' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(
          kind === 'file' ? fileSystem.writeFile : fileSystem.createFolder,
        ).toHaveBeenCalledTimes(1)
        expect(screen.queryByRole('textbox')).toBeNull()
      })
    },
  )

  it('keeps IME confirmation in the input and submits only the following Enter', async () => {
    render(<Harness />)
    const input = await startCreation('file')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '中文笔记' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByRole('textbox')).toBe(input)
    expect(fileSystem.writeFile).not.toHaveBeenCalled()

    fireEvent.compositionEnd(input, { data: '中文笔记' })
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })
    await settleFocus()
    expect(fileSystem.writeFile).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() =>
      expect(fileSystem.writeFile).toHaveBeenCalledWith('/workspace/中文笔记.md', ''),
    )
    expect(fileSystem.writeFile).toHaveBeenCalledTimes(1)
  })

  it('cancels a draft with Escape and an empty draft when focus moves outside', async () => {
    render(<Harness />)
    const input = await startCreation('folder')
    fireEvent.change(input, { target: { value: 'Draft' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(fileSystem.createFolder).not.toHaveBeenCalled()

    await startCreation('file')
    act(() => screen.getByRole('button', { name: 'Refresh view' }).focus())
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(fileSystem.writeFile).not.toHaveBeenCalled()
  })

  it('retains an invalid name and a failed creation so the user can correct and retry', async () => {
    render(<Harness />)
    const input = await startCreation('file')
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'))
    expect(screen.getByRole('textbox')).toBe(input)
    expect(fileSystem.writeFile).not.toHaveBeenCalled()

    vi.mocked(fileSystem.fileExists).mockResolvedValue(true)
    fireEvent.change(input, { target: { value: 'Existing' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await settleFocus()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(fileSystem.writeFile).not.toHaveBeenCalled()

    vi.mocked(fileSystem.fileExists).mockResolvedValue(false)
    vi.mocked(fileSystem.writeFile).mockRejectedValueOnce(new Error('Write failed'))
    fireEvent.change(input, { target: { value: 'Retry' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.getByText('Write failed')).not.toBeNull())
    expect(screen.getByRole('textbox')).toBe(input)
    expect(input.value).toBe('Retry')

    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull())
    expect(fileSystem.writeFile).toHaveBeenCalledTimes(2)
  })

  it('does not apply a stale name check to the latest input', async () => {
    let resolveOldCheck!: (exists: boolean) => void
    vi.mocked(fileSystem.fileExists).mockImplementation((path) =>
      path.endsWith('/Old.md')
        ? new Promise((resolve) => {
            resolveOldCheck = resolve
          })
        : Promise.resolve(false),
    )
    render(<Harness />)
    const input = await startCreation('file')
    fireEvent.change(input, { target: { value: 'Old' } })
    await waitFor(() => expect(fileSystem.fileExists).toHaveBeenCalledWith('/workspace/Old.md'))
    fireEvent.change(input, { target: { value: 'Latest' } })
    await settleFocus()

    await act(async () => resolveOldCheck(true))
    expect(input.hasAttribute('aria-invalid')).toBe(false)
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() =>
      expect(fileSystem.writeFile).toHaveBeenCalledWith('/workspace/Latest.md', ''),
    )
  })
})

describe('FileTree saved directory restoration', () => {
  it('loads only expanded branches, including descendants that receive new IDs on restart', async () => {
    vi.mocked(fileSystem.readSubdirectory).mockImplementation(async (path) => {
      if (path === '/workspace/docs')
        return [
          {
            id: 'new-nested',
            kind: 'dir',
            name: 'Nested',
            path: '/workspace/docs/nested',
            children: [],
          },
        ]
      if (path === '/workspace/docs/nested')
        return [
          {
            id: 'new-note',
            kind: 'file',
            name: 'Restored.md',
            path: '/workspace/docs/nested/note.md',
          },
        ]
      return []
    })
    const onPathsChange = vi.fn()
    const props = {
      initialChildren: [
        {
          id: 'new-docs',
          kind: 'dir' as const,
          name: 'Docs',
          path: '/workspace/docs',
          children: [],
        },
        {
          id: 'other',
          kind: 'dir' as const,
          name: 'Other',
          path: '/workspace/other',
          children: [],
        },
      ],
      initialExpandedPaths: ['/workspace', '/workspace/docs', '/workspace/docs/nested'],
      onPathsChange,
    }
    const first = render(<Harness {...props} />)
    await screen.findByText('Restored.md')
    expect(fileSystem.readSubdirectory).toHaveBeenCalledTimes(2)
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalledWith('/workspace/other')
    act(() => fileTreeHandler.rootTree?.close('new-docs'))
    expect(onPathsChange).toHaveBeenLastCalledWith(['/workspace', '/workspace/docs/nested'])
    first.unmount()
    vi.mocked(fileSystem.readSubdirectory).mockClear()
    render(<Harness {...props} initialExpandedPaths={onPathsChange.mock.lastCall![0]} />)
    expect(screen.queryByText('Restored.md')).toBeNull()
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalled()
  })

  it('keeps the root collapsed when the saved expansion list is empty', () => {
    render(
      <Harness
        initialExpandedPaths={[]}
        initialChildren={[
          { id: 'doc', kind: 'file', name: 'Hidden.md', path: '/workspace/hidden.md' },
        ]}
      />,
    )
    expect(screen.getByText('Workspace')).toBeTruthy()
    expect(screen.queryByText('Hidden.md')).toBeNull()
    expect(fileSystem.readSubdirectory).not.toHaveBeenCalled()
  })

  it('ignores a delayed restored-directory response after unmount', async () => {
    let resolve!: (files: IFile[]) => void
    vi.mocked(fileSystem.readSubdirectory).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    const view = render(
      <Harness
        initialExpandedPaths={['/workspace', '/workspace/docs']}
        initialChildren={[
          { id: 'docs', kind: 'dir', name: 'Docs', path: '/workspace/docs', children: [] },
        ]}
      />,
    )
    await waitFor(() => expect(fileSystem.readSubdirectory).toHaveBeenCalledWith('/workspace/docs'))
    view.unmount()
    await act(async () =>
      resolve([{ id: 'late', kind: 'file', name: 'Late.md', path: '/workspace/docs/late.md' }]),
    )
    expect(screen.queryByText('Late.md')).toBeNull()
  })
})
