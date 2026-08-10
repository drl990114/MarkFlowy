import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorLayoutNode } from '@/stores/useEditorStore'
import EditorLayoutView from './EditorLayoutView'

const layoutTestState = vi.hoisted(() => ({
  callbacks: new Map<string, (layout: Record<string, number>) => void>(),
  setBranchSizes: vi.fn(),
}))

vi.mock('react-resizable-panels', () => ({
  Group: (props: {
    children: ReactNode
    className?: string
    disabled?: boolean
    id?: string
    onLayoutChanged?: (layout: Record<string, number>) => void
  }) => {
    if (props.id && props.onLayoutChanged) {
      layoutTestState.callbacks.set(props.id, props.onLayoutChanged)
    }
    return (
      <div className={props.className} data-disabled={String(Boolean(props.disabled))}>
        {props.children}
      </div>
    )
  },
  Panel: (props: {
    children: ReactNode
    className?: string
    'data-mf-zen-path'?: string
    id?: string
  }) => (
    <section
      className={props.className}
      data-mf-zen-path={props['data-mf-zen-path']}
      data-panel-id={props.id}
    >
      {props.children}
    </section>
  ),
  Separator: () => <span data-separator='' />,
}))

vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      activeGroupId: 'bottom-right',
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

vi.mock('./Editor', () => ({
  default: ({ id }: { id: string }) => <div data-editor-marker={id} />,
}))

vi.mock('./EditorAreaTabs', () => ({
  default: ({ groupId }: { groupId: string }) => <div data-tab-group={groupId} />,
}))

vi.mock('./EditorGroupToolbar', () => ({
  default: () => <div data-toolbar='' />,
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

const layout: EditorLayoutNode = {
  type: 'branch',
  id: 'root',
  direction: 'horizontal',
  sizes: [35, 65],
  children: [
    leaf('left'),
    {
      type: 'branch',
      id: 'right-column',
      direction: 'vertical',
      sizes: [45, 55],
      children: [leaf('top-right'), leaf('bottom-right')],
    },
  ],
}

beforeEach(() => {
  layoutTestState.callbacks.clear()
  layoutTestState.setBranchSizes.mockClear()
})

describe('EditorLayoutView Zen Mode', () => {
  it('renders every group while marking only the nested active path as visible', () => {
    const markup = renderToStaticMarkup(
      <EditorLayoutView activeGroupId='bottom-right' node={layout} zenModeActive />,
    )

    expect(markup).toContain('data-editor-marker="editor-left"')
    expect(markup).toContain('data-editor-marker="editor-top-right"')
    expect(markup).toContain('data-editor-marker="editor-bottom-right"')
    expect(markup.match(/data-mf-zen-path=""/g)).toHaveLength(2)
    expect(markup).toContain('data-mf-zen-active=""')
  })

  it('ignores split-size callbacks during Zen and persists them normally after exit', () => {
    renderToStaticMarkup(
      <EditorLayoutView activeGroupId='bottom-right' node={layout} zenModeActive />,
    )

    layoutTestState.callbacks.get('editor-split-root')?.({
      'editor-layout-panel-left': 20,
      'editor-layout-panel-right-column': 80,
    })
    expect(layoutTestState.setBranchSizes).not.toHaveBeenCalled()
    expect(layout.sizes).toEqual([35, 65])

    renderToStaticMarkup(
      <EditorLayoutView activeGroupId='bottom-right' node={layout} zenModeActive={false} />,
    )
    layoutTestState.callbacks.get('editor-split-root')?.({
      'editor-layout-panel-left': 30,
      'editor-layout-panel-right-column': 70,
    })
    expect(layoutTestState.setBranchSizes).toHaveBeenCalledWith('root', [30, 70])
  })
})
