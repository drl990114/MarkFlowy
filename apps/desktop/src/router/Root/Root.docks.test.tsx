import type { ComponentProps } from 'react'
import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useLayoutStore, { DOCK_PREFERENCES_STORAGE_KEY } from '@/stores/useLayoutStore'
import Root from '.'

const commands = vi.hoisted(() => new Map<string, () => void>())
const context = vi.hoisted(() => ({ rootPath: '/workspace' as string | undefined }))

vi.mock('@/commands', () => ({
  commandRegistry: {
    registerCommand: ({ id, handler }: { id: string; handler: () => void }) => {
      commands.set(id, handler)
      return { dispose: () => commands.delete(id) }
    },
  },
}))
vi.mock('@/components/SideBar', () => ({ default: () => <input aria-label='Explorer state' /> }))
vi.mock('@/components/SideBar/RightBar', () => ({
  default: () => <input aria-label='TOC state' />,
}))
vi.mock('@/components/SideBar/DockSwitcher', () => ({ scheduleDockFocus: vi.fn() }))
vi.mock('@/components/EditorArea', () => ({ default: () => <div>Editor</div> }))
vi.mock('@/components/EditorArea/focusActiveEditor', () => ({
  scheduleActiveEditorFocus: vi.fn(),
}))
vi.mock('@/components/StatusBar', () => ({ default: () => null }))
vi.mock('@/components/Layout', () => ({
  PageLayout: (props: ComponentProps<'div'>) => <div {...props} />,
}))
vi.mock('@/extensions/bookmarks/BookMarkDialog', () => ({ BookMarkDialog: () => null }))
vi.mock('@/extensions/bookmarks/useBookMarksStore', () => ({
  default: () => ({ getBookMarkList: vi.fn() }),
}))
vi.mock('@/extensions/quick-open/QuickOpenDialog', () => ({ QuickOpenDialog: () => null }))
vi.mock('@/extensions/command-palette/CommandPaletteDialog', () => ({ CommandPaletteDialog: () => null }))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/editor-file', () => ({ ensureDocument: vi.fn() }))
vi.mock('@/stores', () => ({ useEditorStore: Object.assign(
  (selector: (state: unknown) => unknown) => selector({ folderData: context.rootPath ? [{ path: context.rootPath }] : null }),
  { getState: () => ({ activeId: 'editor' }), subscribe: () => () => {} },
) }))
vi.mock('zens', () => ({ toast: { info: vi.fn() } }))
vi.mock('./ZenModeHint', () => ({ ZenModeHint: () => null }))

let windowWidth = 1200
const ariaDisabledDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'ariaDisabled')
const resizeObservers = new Map<
  ResizeObserver,
  {
    callback: ResizeObserverCallback
    elements: Set<Element>
  }
>()

// happy-dom has no flex layout. Supply only geometry and resize notifications;
// keep the real panel library's constraints, hit testing and input handlers.
function getLayoutRect(element: HTMLElement): DOMRect {
  if (!element.matches('[data-panel], [data-separator]')) {
    return new DOMRect(0, 0, windowWidth, 800)
  }

  const siblings = Array.from(element.parentElement!.children) as HTMLElement[]
  const zenMode = Boolean(element.closest('[data-mf-zen-mode]'))
  const separators = siblings.filter((sibling) => sibling.hasAttribute('data-separator'))
  const separatorWidth = (handleElement: HTMLElement) =>
    zenMode || handleElement.hasAttribute('data-mf-hidden') ? 0 : 1
  const availableWidth =
    windowWidth - separators.reduce((sum, item) => sum + separatorWidth(item), 0)
  const panels = siblings.filter((sibling) => sibling.hasAttribute('data-panel'))
  const totalGrow = panels.reduce(
    (sum, panelElement) => sum + Number(panelElement.style.flexGrow),
    0,
  )
  const fixedWidth = panels.reduce(
    (sum, panelElement) => sum + (parseFloat(panelElement.style.flexBasis) || 0),
    0,
  )
  const widthOf = (sibling: HTMLElement) => {
    if (sibling.hasAttribute('data-separator')) return separatorWidth(sibling)
    if (zenMode) return sibling.id === 'root-center' ? availableWidth : 0
    if (totalGrow > 0) {
      return (
        (parseFloat(sibling.style.flexBasis) || 0) +
        ((availableWidth - fixedWidth) * Number(sibling.style.flexGrow)) / totalGrow
      )
    }
    return (
      parseFloat(sibling.style.flexBasis) ||
      (sibling.id === 'root-center' ? availableWidth - fixedWidth : 0)
    )
  }
  const index = siblings.indexOf(element)
  const left = siblings.slice(0, index).reduce((sum, sibling) => sum + widthOf(sibling), 0)
  return new DOMRect(left, 0, widthOf(element), 800)
}

function notifyResize() {
  act(() => {
    resizeObservers.forEach(({ callback, elements }, observer) => {
      callback(
        Array.from(elements, (target) => {
          const contentRect = target.getBoundingClientRect()
          return {
            target,
            contentRect,
            borderBoxSize: [{ inlineSize: contentRect.width, blockSize: contentRect.height }],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
          }
        }),
        observer,
      )
    })
  })
}

function panel(side: 'left' | 'right') {
  return document.getElementById(`root-${side}`)!
}

function separator(side: 'left' | 'right') {
  return document.querySelectorAll<HTMLElement>('[data-mf-root-separator]')[side === 'left' ? 0 : 1]
}

async function toggle(side: 'left' | 'right') {
  await act(async () =>
    commands.get(
      side === 'left' ? 'app_toggleLeftsidebarVisible' : 'app_toggleRightsidebarVisible',
    )!(),
  )
  notifyResize()
}

async function renderLayout() {
  await act(async () => {
    render(
      <ThemeProvider theme={desktopLightTheme}>
        <Root />
      </ThemeProvider>,
    )
  })
  notifyResize()
}

beforeEach(() => {
  windowWidth = 1200
  context.rootPath = '/workspace'
  localStorage.removeItem(DOCK_PREFERENCES_STORAGE_KEY)
  useLayoutStore.setState({
    hasWorkspace: true,
    workspaceDocks: undefined,
    leftBar: { activePanelId: 'explorer', size: 240, visible: true },
    rightBar: { activePanelId: 'toc', size: 280, visible: true },
    zenModeActive: false,
  })
  // This happy-dom version does not reflect aria-disabled through Element.ariaDisabled.
  Object.defineProperty(Element.prototype, 'ariaDisabled', {
    configurable: true,
    get(this: Element) {
      return this.getAttribute('aria-disabled')
    },
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    return getLayoutRect(this)
  })
  for (const [property, dimension] of [
    ['offsetWidth', 'width'],
    ['offsetHeight', 'height'],
    ['offsetLeft', 'x'],
    ['offsetTop', 'y'],
  ] as const) {
    vi.spyOn(HTMLElement.prototype, property, 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.getBoundingClientRect()[dimension]
    })
  }
  vi.stubGlobal(
    'ResizeObserver',
    class implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeObservers.set(this, { callback, elements: new Set() })
      }
      observe(element: Element) {
        resizeObservers.get(this)!.elements.add(element)
      }
      unobserve(element: Element) {
        resizeObservers.get(this)!.elements.delete(element)
      }
      disconnect() {
        resizeObservers.delete(this)
      }
    },
  )
})

afterEach(() => {
  cleanup()
  resizeObservers.clear()
  commands.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (ariaDisabledDescriptor) {
    Object.defineProperty(Element.prototype, 'ariaDisabled', ariaDisabledDescriptor)
  } else {
    Reflect.deleteProperty(Element.prototype, 'ariaDisabled')
  }
})

describe('Root dock resizing', () => {
  it('restores separate document and workspace widths even when both docks stay visible', async () => {
    useLayoutStore.setState({ documentDocks: {
      leftBar: { activePanelId: 'bookmarks', size: 210, visible: true },
      rightBar: { activePanelId: 'ai', size: 320, visible: true },
    } })
    await renderLayout()
    act(() => {
      context.rootPath = undefined
      useLayoutStore.getState().setWorkspaceContext(false)
    })
    notifyResize()
    expect(panel('left').offsetWidth).toBeCloseTo(210, 0)
    expect(panel('right').offsetWidth).toBeCloseTo(320, 0)
    act(() => {
      context.rootPath = '/workspace'
      useLayoutStore.getState().setWorkspaceContext(true)
    })
    notifyResize()
    expect(panel('left').offsetWidth).toBeCloseTo(240, 0)
    expect(panel('right').offsetWidth).toBeCloseTo(280, 0)
  })

  it('leaves no separator or resize target at either window edge when docks start closed', async () => {
    useLayoutStore.getState().setLeftBarVisible(false)
    useLayoutStore.getState().setRightBarVisible(false)
    await renderLayout()

    expect(screen.queryAllByRole('separator')).toHaveLength(0)
    for (const side of ['left', 'right'] as const) {
      expect(panel(side).offsetWidth).toBe(0)
      expect(panel(side).hasAttribute('inert')).toBe(true)
      expect(getComputedStyle(separator(side)).display).toBe('none')
      const group = panel(side).parentElement!
      const clientX = side === 'left' ? 1 : windowWidth - 1
      fireEvent.pointerDown(group, {
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX,
        clientY: 100,
      })
      fireEvent.pointerMove(document, { buttons: 1, clientX: windowWidth / 2, clientY: 100 })
      fireEvent.pointerUp(document)
    }
    notifyResize()
    expect(panel('left').offsetWidth).toBe(0)
    expect(panel('right').offsetWidth).toBe(0)
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
    expect(useLayoutStore.getState().rightBar.visible).toBe(false)
  })

  it.each(['left', 'right'] as const)(
    'resizes the %s dock and restores its width and content through command toggles',
    async (side) => {
      await renderLayout()
      const input = screen.getByLabelText(side === 'left' ? 'Explorer state' : 'TOC state')
      fireEvent.change(input, { target: { value: 'keep this state' } })
      const previousWidth = panel(side).offsetWidth
      fireEvent.keyDown(separator(side), { key: side === 'left' ? 'ArrowRight' : 'ArrowLeft' })
      notifyResize()
      const resizedWidth = panel(side).offsetWidth
      expect(resizedWidth).toBeGreaterThan(previousWidth)

      await toggle(side)
      expect(panel(side).offsetWidth).toBe(0)
      expect(getComputedStyle(separator(side)).display).toBe('none')
      await toggle(side)
      expect(panel(side).offsetWidth).toBeCloseTo(Math.round(resizedWidth), 0)
      expect(screen.getByLabelText(side === 'left' ? 'Explorer state' : 'TOC state')).toBe(input)
      expect((input as HTMLInputElement).value).toBe('keep this state')
    },
  )

  it.each(['left', 'right'] as const)(
    'closes the %s dock by dragging and requires its command to reopen it',
    async (side) => {
      await renderLayout()
      const handle = separator(side)
      const start = handle.getBoundingClientRect().x
      const previousWidth = panel(side).offsetWidth
      fireEvent.pointerDown(handle, {
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX: start,
        clientY: 100,
      })
      fireEvent.pointerMove(document, {
        buttons: 1,
        clientX: side === 'left' ? -200 : windowWidth + 200,
        clientY: 100,
      })
      fireEvent.pointerUp(document)
      notifyResize()

      expect(panel(side).offsetWidth).toBe(0)
      expect(useLayoutStore.getState()[side === 'left' ? 'leftBar' : 'rightBar'].visible).toBe(
        false,
      )
      expect(getComputedStyle(handle).display).toBe('none')

      // A new drag from the window edge must not pull the hidden dock back out.
      fireEvent.pointerDown(panel(side).parentElement!, {
        pointerType: 'mouse',
        button: 0,
        buttons: 1,
        clientX: side === 'left' ? 1 : windowWidth - 1,
        clientY: 100,
      })
      fireEvent.pointerMove(document, { buttons: 1, clientX: windowWidth / 2, clientY: 100 })
      fireEvent.pointerUp(document)
      notifyResize()
      expect(panel(side).offsetWidth).toBe(0)

      await toggle(side)
      expect(panel(side).offsetWidth).toBeCloseTo(Math.round(previousWidth), 0)
      expect(useLayoutStore.getState()[side === 'left' ? 'leftBar' : 'rightBar'].visible).toBe(true)
    },
  )

  it('keeps both sidebars in the editor layout in a narrow window without dismissing on outside clicks', async () => {
    windowWidth = 840
    await renderLayout()
    const editor = screen.getByText('Editor')
    const group = document.getElementById('root-center')!.parentElement
    expect(panel('left').parentElement).toBe(group)
    expect(panel('right').parentElement).toBe(group)
    expect(panel('left').offsetWidth).toBeGreaterThan(0)
    expect(panel('right').offsetWidth).toBeGreaterThan(0)
    expect(screen.getAllByRole('separator')).toHaveLength(2)

    fireEvent.pointerDown(editor)
    fireEvent.pointerUp(editor)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useLayoutStore.getState().leftBar.visible).toBe(true)
    expect(useLayoutStore.getState().rightBar.visible).toBe(true)

    await toggle('right')
    await toggle('right')
    expect(panel('right').parentElement).toBe(group)
    expect(panel('right').offsetWidth).toBeGreaterThan(0)
  })

  it('restores saved dock widths and visibility after Zen Mode', async () => {
    useLayoutStore.getState().setDockSize('left', 304)
    useLayoutStore.getState().setDockSize('right', 336)
    await renderLayout()
    await act(async () => useLayoutStore.getState().setZenModeActive(true))
    notifyResize()
    expect(screen.queryAllByRole('separator')).toHaveLength(0)
    await act(async () => useLayoutStore.getState().setZenModeActive(false))
    notifyResize()
    expect(panel('left').offsetWidth).toBeCloseTo(304, 0)
    expect(panel('right').offsetWidth).toBeCloseTo(336, 0)
  })
})
