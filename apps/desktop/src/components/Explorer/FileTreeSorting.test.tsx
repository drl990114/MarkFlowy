import { desktopLightTheme } from '@markflowy/theme'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useMemo, useState, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FileTree, { fileTreeHandler } from '../../../../../packages/interface/src/components/FileTree/FileTree'
import { SimpleTree } from '../../../../../packages/interface/src/components/FileTree/types'
import { FileSystemContext, type FileSystemContextValue } from '../../../../../packages/interface/src/contexts/FileSystemContext'
import { FileTreeContext } from '../../../../../packages/interface/src/contexts/FileTreeContext'
import type { IFile } from '../../../../../packages/interface/src/types/file'
import { createExplorerStateStore } from '@/stores/useExplorerStateStore'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ExplorerSortMenu } from './ExplorerSortMenu'
import { createExplorerComparator } from './explorerSorting'

vi.mock('@markflowy/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

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

const file = (name: string, parent = '/workspace'): IFile => ({
  id: `${parent}/${name}`, name, kind: 'file', path: `${parent}/${name}`,
})
const expanded = ['/workspace', '/workspace/Docs']
function fixture(): IFile[] {
  return [{
    id: 'root', name: 'Workspace', kind: 'dir', path: '/workspace',
    children: [
      file('note10.md'),
      { id: 'docs', name: 'Docs', kind: 'dir', path: '/workspace/Docs', children: [
        file('chapter10.md', '/workspace/Docs'), file('chapter2.md', '/workspace/Docs'),
      ] },
      file('note2.md'),
      { id: 'lazy', name: 'Folder2', kind: 'dir', path: '/workspace/Folder2', children: [] },
    ],
  }]
}
function FillFlexParent({ children }: {
  children: (dimensions: { width: number; height: number }) => ReactNode
}) {
  return children({ width: 360, height: 420 })
}
function Harness({ initialData }: { initialData: IFile[] }) {
  const [data, setData] = useState(initialData)
  const [useView] = useState(() => createExplorerStateStore('/workspace'))
  const direction = useView((state) => state.sortDirection)
  const setDirection = useView((state) => state.setSortDirection)
  const paths = useView((state) => state.expandedPaths)
  const setPaths = useView((state) => state.setExpandedPaths)
  const compareNodes = useMemo(() => createExplorerComparator(direction), [direction])
  return (
    <ThemeProvider theme={desktopLightTheme}>
      <TooltipProvider>
      <FileSystemContext.Provider value={fileSystem}>
        <FileTreeContext.Provider value={{
          activeId: '/workspace/note10.md', folderData: data,
          setFolderData: setData, setFolderDataPure: setData,
          deleteNode: vi.fn(), trashNode: vi.fn(), refreshFolder: vi.fn(),
          getRootPath: () => '/workspace',
        }}>
          <FileTree
            data={data}
            compareNodes={compareNodes}
            rootActions={<ExplorerSortMenu direction={direction} onDirectionChange={setDirection} />}
            expandedPaths={paths ?? expanded}
            onExpandedPathsChange={setPaths}
            disableDrag
            fillFlexParentComponent={FillFlexParent}
            getFileObject={(id) => new SimpleTree(data).find(id)?.data}
            getFileObjectByPath={() => undefined}
            onShowConfirm={vi.fn()}
            onShowContextMenu={vi.fn()}
            rowHeight={26}
          />
        </FileTreeContext.Provider>
      </FileSystemContext.Provider>
      </TooltipProvider>
    </ThemeProvider>
  )
}
const visibleNames = () => screen.getAllByRole('treeitem').map((row) => row.textContent)
async function selectDescending() {
  fireEvent.keyDown(screen.getByRole('button', { name: 'explorer.sort' }), { key: 'ArrowDown' })
  const item = await screen.findByRole('menuitemradio', { name: 'explorer.sort_name_desc' })
  fireEvent.click(item)
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  vi.mocked(fileSystem.readSubdirectory).mockResolvedValue([
    file('loaded2.md', '/workspace/Folder2'), file('loaded10.md', '/workspace/Folder2'),
  ])
})
afterEach(cleanup)

describe('Explorer sorting in the real file tree', () => {
  it('changes every sibling group, preserves selection/expansion and sorts later directory reads', async () => {
    const data = fixture()
    const backingChildren = [...data[0].children!]
    render(<Harness initialData={data} />)
    await waitFor(() => expect(visibleNames()).toEqual([
      'Workspace', 'Docs', 'chapter2.md', 'chapter10.md', 'Folder2', 'note2.md', 'note10.md',
    ]))
    await selectDescending()
    await waitFor(() => expect(visibleNames()).toEqual([
      'Workspace', 'Folder2', 'Docs', 'chapter10.md', 'chapter2.md', 'note10.md', 'note2.md',
    ]))
    expect(data[0].children).toEqual(backingChildren)
    expect(fileTreeHandler.rootTree?.get('/workspace/note10.md')?.data).toBe(backingChildren[0])
    expect(screen.getByText('note10.md').closest('[role="treeitem"]')?.getAttribute('aria-selected')).toBe('true')
    fireEvent.click(screen.getByText('Folder2'))
    await waitFor(() => expect(visibleNames()).toEqual([
      'Workspace', 'Folder2', 'loaded10.md', 'loaded2.md', 'Docs',
      'chapter10.md', 'chapter2.md', 'note10.md', 'note2.md',
    ]))
    expect(fileSystem.readSubdirectory).toHaveBeenCalledExactlyOnceWith('/workspace/Folder2')
  })

  it('restores the chosen direction after remounting the workspace', async () => {
    const view = render(<Harness initialData={fixture()} />)
    await screen.findByText('chapter2.md')
    await selectDescending()
    await waitFor(() => expect(visibleNames()[1]).toBe('Folder2'))
    view.unmount()
    render(<Harness initialData={fixture()} />)
    await waitFor(() => expect(visibleNames()[1]).toBe('Folder2'))
    fireEvent.keyDown(screen.getByRole('button', { name: 'explorer.sort' }), { key: 'ArrowDown' })
    expect((await screen.findByRole('menuitemradio', { name: 'explorer.sort_name_desc' }))
      .getAttribute('aria-checked')).toBe('true')
  })
})
