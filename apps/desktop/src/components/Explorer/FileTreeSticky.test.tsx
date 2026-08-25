import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { NodeApi, RowRendererProps } from 'react-arborist'
import type { ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { IFile } from '../../../../../packages/interface/src/types/file'
import FileTree, {
  FileTreeRow,
  shouldShowFileTreeStickyRoot,
} from '../../../../../packages/interface/src/components/FileTree/FileTree'

type MockTreeProps = {
  children: (props: {
    dragHandle?: (element: HTMLDivElement | null) => void
    node: NodeApi<IFile>
    style: React.CSSProperties
    tree: {
      focus: (node: NodeApi<IFile>) => void
      get: (id: string | null) => NodeApi<IFile> | null
      isOpen: () => boolean
      update: () => void
    }
  }) => ReactNode
  data: IFile[]
  indent?: number
  initialOpenState?: Record<string, boolean>
  onScroll?: (state: { scrollOffset: number }) => void
  onToggle?: (id: string) => void
  openByDefault?: boolean
  rowClassName?: string
  rowHeight?: number
}

const treeHarness = vi.hoisted(() => ({
  props: null as MockTreeProps | null,
  root: null as NodeApi<IFile> | null,
  setVirtualRootMounted: null as ((mounted: boolean) => void) | null,
}))

vi.mock('react-arborist', async () => {
  const React = await import('react')

  return {
    Tree: (props: MockTreeProps) => {
      const [, setOpenRevision] = React.useState(0)
      const [virtualRootMounted, setVirtualRootMounted] = React.useState(true)
      const isOpenRef = React.useRef(true)
      const propsRef = React.useRef(props)
      propsRef.current = props
      treeHarness.props = props
      treeHarness.setVirtualRootMounted = setVirtualRootMounted

      const { root, tree } = React.useMemo(() => {
        const updateOpenState = (nextOpen: boolean) => {
          isOpenRef.current = nextOpen
          setOpenRevision((current) => current + 1)
          propsRef.current.onToggle?.(propsRef.current.data[0]?.id)
        }
        const rootNode = {
          activate: vi.fn(),
          close: vi.fn(() => updateOpenState(false)),
          data: props.data[0],
          handleClick: vi.fn(),
          id: props.data[0]?.id,
          isInternal: true,
          isSelected: false,
          open: vi.fn(() => updateOpenState(true)),
          select: vi.fn(),
          toggle: vi.fn(() => updateOpenState(!isOpenRef.current)),
        } as unknown as NodeApi<IFile>
        const treeApi = {
          focus: vi.fn(() => setVirtualRootMounted(true)),
          get: (id: string | null) => (id === rootNode.id ? rootNode : null),
          isOpen: () => isOpenRef.current,
          update: vi.fn(),
        }
        rootNode.tree = treeApi as unknown as NodeApi<IFile>['tree']

        return { root: rootNode, tree: treeApi }
        // The mocked NodeApi and TreeApi must remain stable while virtualization
        // independently mounts and unmounts the real row.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])

      Object.defineProperties(root, {
        isOpen: { configurable: true, get: () => isOpenRef.current },
        isSelected: { configurable: true, get: () => false },
      })
      treeHarness.root = root

      return React.createElement(
        'div',
        { 'data-testid': 'virtual-tree', role: 'tree' },
        virtualRootMounted
          ? props.children({ node: root, style: { paddingLeft: 0 }, tree })
          : null,
      )
    },
  }
})

vi.mock('../../../../../packages/interface/src/contexts/FileTreeContext', () => ({
  useFileTree: () => ({ activeId: undefined, setFolderDataPure: vi.fn() }),
}))

vi.mock('../../../../../packages/interface/src/contexts/FileSystemContext', () => ({
  useFileSystem: () => ({
    fileExists: vi.fn(),
    moveFilesToTargetFolder: vi.fn(),
    pathJoin: vi.fn(),
    readSubdirectory: vi.fn().mockResolvedValue([]),
    runFileMutation: vi.fn(),
  }),
}))

vi.mock('../../../../../packages/interface/src/components/FileTree/FileNode', async () => {
  const React = await import('react')

  return {
    default: (props: {
      isRootSuppressed?: boolean
      isStickyRoot?: boolean
      node: NodeApi<IFile>
    }) =>
      React.createElement(
        'div',
        {
          'aria-hidden': props.isRootSuppressed || undefined,
          'data-root-suppressed': props.isRootSuppressed || undefined,
          'data-testid': props.isStickyRoot ? 'sticky-root-node' : 'virtual-root-node',
          inert: props.isRootSuppressed || undefined,
        },
        React.createElement('span', null, props.node.data.name),
        React.createElement(
          'button',
          { onClick: (event) => event.stopPropagation(), type: 'button' },
          'Root action',
        ),
      ),
  }
})

afterEach(() => {
  cleanup()
  treeHarness.props = null
  treeHarness.root = null
  treeHarness.setVirtualRootMounted = null
})

const rootFile: IFile = {
  id: 'workspace-root',
  kind: 'dir',
  name: 'markflowy',
  path: '/workspace/markflowy',
}

function createRowProps(): RowRendererProps<IFile> {
  return {
    attrs: {
      'aria-level': 1,
      role: 'treeitem',
      style: { height: 24, position: 'absolute', top: 0 },
      tabIndex: -1,
    },
    children: <button type='button'>Root action</button>,
    innerRef: vi.fn(),
    node: {
      data: rootFile,
      handleClick: vi.fn(),
      id: rootFile.id,
    } as unknown as NodeApi<IFile>,
  }
}

describe('FileTree sticky workspace root', () => {
  it('pins only after the virtualized list has moved away from its top edge', () => {
    expect(shouldShowFileTreeStickyRoot(0)).toBe(false)
    expect(shouldShowFileTreeStickyRoot(0.5)).toBe(true)
    expect(shouldShowFileTreeStickyRoot(24)).toBe(true)
  })

  it('opens only the first workspace root by default', () => {
    const secondRoot: IFile = {
      id: 'second-root',
      kind: 'dir',
      name: 'second',
      path: '/workspace/second',
    }

    render(
      <ThemeProvider theme={desktopLightTheme}>
        <FileTree
          data={[rootFile, secondRoot]}
          fillFlexParentComponent={({ children }) => children({ height: 120, width: 240 })}
          getFileObject={() => undefined}
          getFileObjectByPath={() => undefined}
          onSelect={vi.fn()}
          onShowConfirm={vi.fn()}
          onShowContextMenu={vi.fn()}
        />
      </ThemeProvider>,
    )

    expect(treeHarness.props?.openByDefault).toBe(false)
    expect(treeHarness.props?.initialOpenState).toEqual({ [rootFile.id]: true })
  })

  it('initially opens the new root after switching workspaces', () => {
    const nextRoot: IFile = {
      id: 'next-workspace-root',
      kind: 'dir',
      name: 'next',
      path: '/workspace/next',
    }
    const renderTree = (data: IFile[]) => (
      <ThemeProvider theme={desktopLightTheme}>
        <FileTree
          data={data}
          fillFlexParentComponent={({ children }) => children({ height: 120, width: 240 })}
          getFileObject={() => undefined}
          getFileObjectByPath={() => undefined}
          onSelect={vi.fn()}
          onShowConfirm={vi.fn()}
          onShowContextMenu={vi.fn()}
        />
      </ThemeProvider>
    )
    const view = render(renderTree([rootFile]))

    view.rerender(renderTree([nextRoot]))

    expect(treeHarness.root?.id).toBe(nextRoot.id)
    expect(treeHarness.props?.initialOpenState).toEqual({ [nextRoot.id]: true })
  })

  it('forwards host density to the virtual list and pinned root', () => {
    render(
      <ThemeProvider theme={desktopLightTheme}>
        <FileTree
          data={[rootFile]}
          fillFlexParentComponent={({ children }) => children({ height: 120, width: 240 })}
          getFileObject={() => undefined}
          getFileObjectByPath={() => undefined}
          indentSize={20}
          onSelect={vi.fn()}
          onShowConfirm={vi.fn()}
          onShowContextMenu={vi.fn()}
          rowHeight={26}
          stickyRoot
        />
      </ThemeProvider>,
    )

    expect(treeHarness.props?.indent).toBe(20)
    expect(treeHarness.props?.rowClassName).toBe('mf-file-tree-item')
    expect(treeHarness.props?.rowHeight).toBe(26)

    act(() => treeHarness.props?.onScroll?.({ scrollOffset: 1 }))

    expect(
      document.querySelector<HTMLElement>('[data-mf-file-tree-sticky-layer]')?.style.height,
    ).toBe('26px')
    expect(
      document
        .querySelector<HTMLElement>('[data-mf-file-tree-sticky-item]')
        ?.classList.contains('mf-file-tree-item'),
    ).toBe(true)
  })

  it('marks the real root row without suppressing it at scroll top', () => {
    const { container } = render(
      <FileTreeRow {...createRowProps()} rootId={rootFile.id} suppressRoot={false} />,
    )

    const rootRow = container.querySelector('[data-mf-file-tree-root-row="true"]')
    expect(rootRow?.getAttribute('role')).toBe('treeitem')
    expect(rootRow?.hasAttribute('inert')).toBe(false)
    expect(screen.getByRole('button', { name: 'Root action' })).toBeTruthy()
  })

  it('keeps the suppressed treeitem focusable so keyboard reveal can recover the real row', () => {
    const revealRoot = vi.fn()
    const { container } = render(
      <FileTreeRow
        {...createRowProps()}
        revealRoot={revealRoot}
        rootId={rootFile.id}
        suppressRoot
      />,
    )

    const rootRow = container.querySelector<HTMLElement>(
      '[data-mf-file-tree-root-row-suppressed="true"]',
    )
    expect(rootRow?.getAttribute('aria-hidden')).toBeNull()
    expect(rootRow?.hasAttribute('inert')).toBe(false)
    expect(rootRow?.getAttribute('aria-label')).toBe(rootFile.name)

    rootRow?.focus()

    expect(document.activeElement).toBe(rootRow)
    expect(revealRoot).toHaveBeenCalledTimes(1)
  })

  it('mounts the pinned clone from the virtual-list scroll callback', () => {
    render(
      <ThemeProvider theme={desktopLightTheme}>
        <FileTree
          data={[rootFile]}
          fillFlexParentComponent={({ children }) => children({ height: 120, width: 240 })}
          getFileObject={() => undefined}
          getFileObjectByPath={() => undefined}
          onSelect={vi.fn()}
          onShowConfirm={vi.fn()}
          onShowContextMenu={vi.fn()}
          stickyRoot
        />
      </ThemeProvider>,
    )

    expect(screen.queryByTestId('sticky-root-node')).toBeNull()

    act(() => treeHarness.props?.onScroll?.({ scrollOffset: 1 }))

    expect(screen.getByTestId('sticky-root-node')).toBeTruthy()
    const overscannedRoot = screen.getByTestId('virtual-root-node')
    expect(overscannedRoot.getAttribute('data-root-suppressed')).toBe('true')
    expect(overscannedRoot.getAttribute('aria-hidden')).toBe('true')
    expect(overscannedRoot.hasAttribute('inert')).toBe(true)
    expect(screen.getAllByRole('button', { name: 'Root action' })).toHaveLength(1)

    act(() => treeHarness.props?.onScroll?.({ scrollOffset: 0 }))

    expect(screen.queryByTestId('sticky-root-node')).toBeNull()
    expect(screen.getByTestId('virtual-root-node').hasAttribute('data-root-suppressed')).toBe(false)
  })

  it('keeps an accessible, keyboard-operable pinned root after virtualization unmounts it', () => {
    render(
      <ThemeProvider theme={desktopLightTheme}>
        <FileTree
          data={[rootFile]}
          fillFlexParentComponent={({ children }) => children({ height: 120, width: 240 })}
          getFileObject={() => undefined}
          getFileObjectByPath={() => undefined}
          onSelect={vi.fn()}
          onShowConfirm={vi.fn()}
          onShowContextMenu={vi.fn()}
          stickyRoot
        />
      </ThemeProvider>,
    )

    act(() => treeHarness.setVirtualRootMounted?.(false))
    act(() => treeHarness.props?.onScroll?.({ scrollOffset: 2400 }))

    expect(screen.queryByTestId('virtual-root-node')).toBeNull()
    const stickyTree = document.querySelector<HTMLElement>(
      '[data-mf-file-tree-sticky-layer]',
    )
    const stickyRoot = within(stickyTree!).getByRole('treeitem', { name: rootFile.name })
    const rootAction = within(stickyRoot).getByRole('button', { name: 'Root action' })

    expect(stickyTree?.getAttribute('role')).toBe('tree')
    expect(stickyRoot.getAttribute('aria-level')).toBe('1')
    expect(stickyRoot.getAttribute('aria-expanded')).toBe('true')
    expect(stickyRoot.getAttribute('tabindex')).toBe('0')
    expect(stickyRoot.querySelector('button button')).toBeNull()

    stickyRoot.focus()
    expect(document.activeElement).toBe(stickyRoot)

    fireEvent.keyDown(stickyRoot, { key: 'Enter' })
    expect(treeHarness.root?.select).toHaveBeenCalledTimes(1)
    expect(treeHarness.root?.activate).toHaveBeenCalledTimes(1)
    expect(treeHarness.root?.toggle).toHaveBeenCalledTimes(1)
    expect(stickyRoot.getAttribute('aria-expanded')).toBe('false')

    fireEvent.keyDown(stickyRoot, { key: 'ArrowRight' })
    expect(treeHarness.root?.open).toHaveBeenCalledTimes(1)
    expect(stickyRoot.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(stickyRoot, { key: 'ArrowLeft' })
    expect(treeHarness.root?.close).toHaveBeenCalledTimes(1)
    expect(stickyRoot.getAttribute('aria-expanded')).toBe('false')

    const toggleCalls = vi.mocked(treeHarness.root!.toggle).mock.calls.length
    fireEvent.keyDown(rootAction, { key: 'Enter' })
    expect(treeHarness.root?.toggle).toHaveBeenCalledTimes(toggleCalls)

    fireEvent.keyDown(stickyRoot, { key: ' ' })
    expect(treeHarness.root?.select).toHaveBeenCalledTimes(2)
    expect(treeHarness.root?.activate).toHaveBeenCalledTimes(2)
    expect(treeHarness.root?.toggle).toHaveBeenCalledTimes(toggleCalls + 1)
  })

  it.each(['Home', 'ArrowUp'])('returns %s navigation to the real virtual root', (key) => {
    render(
      <ThemeProvider theme={desktopLightTheme}>
        <FileTree
          data={[rootFile]}
          fillFlexParentComponent={({ children }) => children({ height: 120, width: 240 })}
          getFileObject={() => undefined}
          getFileObjectByPath={() => undefined}
          onSelect={vi.fn()}
          onShowConfirm={vi.fn()}
          onShowContextMenu={vi.fn()}
          stickyRoot
        />
      </ThemeProvider>,
    )

    act(() => treeHarness.setVirtualRootMounted?.(false))
    act(() => treeHarness.props?.onScroll?.({ scrollOffset: 2400 }))

    const stickyRoot = screen.getByRole('treeitem', { name: rootFile.name })
    fireEvent.keyDown(stickyRoot, { key })

    expect(treeHarness.root?.tree.focus).toHaveBeenCalledWith(treeHarness.root)
    expect(screen.queryByTestId('sticky-root-node')).toBeNull()
    expect(screen.getByTestId('virtual-root-node')).toBeTruthy()
  })
})
