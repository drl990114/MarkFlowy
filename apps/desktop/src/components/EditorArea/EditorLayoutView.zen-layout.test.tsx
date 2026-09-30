import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorLayoutNode } from '@/stores/useEditorStore'
import EditorLayoutView from './EditorLayoutView'

const layoutTestState = vi.hoisted(() => ({
  activeGroupId: '',
  setBranchSizes: vi.fn(),
}))

vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeGroupId: layoutTestState.activeGroupId,
      editorLayout: { type: 'branch' },
      getGroup: (groupId: string) => ({
        activeId: `editor-${groupId}`,
        id: groupId,
        opened: [`editor-${groupId}`],
        type: 'leaf',
      }),
      moveFileToGroup: vi.fn(),
      setActiveGroupId: vi.fn(),
      setBranchSizes: layoutTestState.setBranchSizes,
    }),
}))

vi.mock('@/helper/files', () => ({
  default: (selector: (state: { entries: Record<string, { name: string }> }) => unknown) =>
    selector({ entries: {} }),
}))

vi.mock('./Editor', () => ({
  default: ({ id }: { id: string }) => (
    <textarea data-editor-marker={id} defaultValue={`initial ${id}`} />
  ),
}))

vi.mock('./EditorAreaTabs', () => ({
  default: ({ groupId }: { groupId: string }) => <div data-tab-group={groupId} />,
}))

vi.mock('./EditorGroupToolbar', () => ({
  default: () => <div data-toolbar='' />,
}))

vi.mock('./ExternalFileChangeAlert', () => ({
  ExternalFileChangeAlert: () => null,
}))

vi.mock('./editorToolBar/FindReplace', () => ({
  FindReplace: () => null,
}))

vi.mock('./EmptyState', () => ({
  EmptyState: () => <div data-empty-state='' />,
}))

const leaf = (id: string): EditorLayoutNode => ({
  type: 'leaf',
  id,
  opened: [`editor-${id}`],
  activeId: `editor-${id}`,
})

const branch = (
  id: string,
  direction: 'horizontal' | 'vertical',
  children: EditorLayoutNode[],
  sizes: number[],
): EditorLayoutNode => ({ type: 'branch', id, direction, children, sizes })

function collectPanelSizes(node: EditorLayoutNode): number[] {
  if (node.type === 'leaf') return []
  return node.children.flatMap((child, index) => [node.sizes[index], ...collectPanelSizes(child)])
}

const scenarios = [
  {
    name: 'horizontal split',
    activeGroupId: 'right',
    layout: branch('root', 'horizontal', [leaf('left'), leaf('right')], [35, 65]),
    activePanelIds: ['right'],
    hiddenPanelIds: ['left'],
  },
  {
    name: 'vertical split',
    activeGroupId: 'top',
    layout: branch('root', 'vertical', [leaf('top'), leaf('bottom')], [40, 60]),
    activePanelIds: ['top'],
    hiddenPanelIds: ['bottom'],
  },
  {
    name: 'horizontal split with a nested vertical split',
    activeGroupId: 'bottom-right',
    layout: branch('root', 'horizontal', [
      leaf('left'),
      branch('right-column', 'vertical', [leaf('top-right'), leaf('bottom-right')], [45, 55]),
    ], [35, 65]),
    activePanelIds: ['right-column', 'bottom-right'],
    hiddenPanelIds: ['left', 'top-right'],
  },
  {
    name: 'vertical split with a nested horizontal split',
    activeGroupId: 'bottom-left',
    layout: branch('root', 'vertical', [
      leaf('top'),
      branch('bottom-row', 'horizontal', [leaf('bottom-left'), leaf('bottom-right')], [60, 40]),
    ], [30, 70]),
    activePanelIds: ['bottom-row', 'bottom-left'],
    hiddenPanelIds: ['top', 'bottom-right'],
  },
]

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('EditorLayoutView Zen layout with react-resizable-panels', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    layoutTestState.setBranchSizes.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  it.each(scenarios)('fills the active path and restores $name without remounting editors', ({
    activeGroupId,
    layout,
    activePanelIds,
    hiddenPanelIds,
  }) => {
    layoutTestState.activeGroupId = activeGroupId
    const render = (zenModeActive: boolean) => act(() => {
      root.render(
        <EditorLayoutView activeGroupId={activeGroupId} node={layout} zenModeActive={zenModeActive} />,
      )
    })
    const panel = (id: string) => {
      const element = container.querySelector<HTMLDivElement>(`#editor-layout-panel-${id}`)
      expect(element).not.toBeNull()
      return element!
    }

    render(false)

    const panels = Array.from(container.querySelectorAll<HTMLDivElement>('[data-panel]'))
    const splitSizes = panels.map((element) => element.style.flexGrow)
    expect(splitSizes).toEqual(collectPanelSizes(layout).map(String))
    const editors = Array.from(container.querySelectorAll<HTMLTextAreaElement>('[data-editor-marker]'))
    const originalLayout = JSON.stringify(layout)
    const activeEditor = editors.find((element) => element.dataset.editorMarker === `editor-${activeGroupId}`)!
    activeEditor.value = 'unsaved editor text'
    activeEditor.setSelectionRange(3, 9)
    activeEditor.scrollTop = 42
    layoutTestState.setBranchSizes.mockClear()

    render(true)

    for (const id of hiddenPanelIds) {
      const element = panel(id)
      // Use the real library's outer flex item, which owns data-panel and sizing.
      expect(element.hasAttribute('data-panel')).toBe(true)
      expect(element.parentElement?.hasAttribute('data-group')).toBe(true)
      expect(getComputedStyle(element).display).toBe('none')
      expect(element.hasAttribute('data-mf-hidden-in-zen')).toBe(true)
      expect(element.firstElementChild?.hasAttribute('data-mf-hidden-in-zen')).toBe(false)
    }

    for (const id of activePanelIds) {
      const element = panel(id)
      expect(element.hasAttribute('data-panel')).toBe(true)
      expect(element.hasAttribute('data-mf-zen-path')).toBe(true)
      const style = getComputedStyle(element)
      expect(style.display).toBe('flex')
      expect(style.flexGrow).toBe('1')
      expect(style.flexShrink).toBe('1')
      expect(style.flexBasis).toBe('100%')
      expect(style.width).toBe('100%')
    }

    for (const separator of container.querySelectorAll<HTMLElement>('[data-separator]')) {
      expect(getComputedStyle(separator).display).toBe('none')
    }
    expect(layoutTestState.setBranchSizes).not.toHaveBeenCalled()
    expect(panels.map((element) => element.style.flexGrow)).toEqual(splitSizes)

    render(false)

    expect(container.querySelector('[data-mf-hidden-in-zen], [data-mf-zen-path]')).toBeNull()
    for (const element of panels) {
      expect(getComputedStyle(element).display).toBe('flex')
      expect(getComputedStyle(element).flexGrow).toBe(element.style.flexGrow)
    }
    for (const separator of container.querySelectorAll<HTMLElement>('[data-separator]')) {
      expect(getComputedStyle(separator).display).not.toBe('none')
    }
    expect(panels.map((element) => element.style.flexGrow)).toEqual(splitSizes)
    expect(JSON.stringify(layout)).toBe(originalLayout)
    const restoredEditors = Array.from(container.querySelectorAll('[data-editor-marker]'))
    expect(restoredEditors).toHaveLength(editors.length)
    restoredEditors.forEach((element, index) => expect(element).toBe(editors[index]))
    expect(activeEditor.value).toBe('unsaved editor text')
    expect(activeEditor.selectionStart).toBe(3)
    expect(activeEditor.selectionEnd).toBe(9)
    expect(activeEditor.scrollTop).toBe(42)
  })
})
