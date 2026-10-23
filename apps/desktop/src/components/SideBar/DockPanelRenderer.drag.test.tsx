import { TooltipProvider } from '@/components/ui/tooltip'
import useLayoutStore from '@/stores/useLayoutStore'
import { desktopDarkTheme } from '@markflowy/theme'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DockPanelRenderer } from './DockPanelRenderer'
import { clearDockDrag, DOCK_PANEL_DRAG_TYPE, useDockDragStore } from './dockDragData'

const nativeHandlers = vi.hoisted(() => ({ dragover: vi.fn(), drop: vi.fn() }))

vi.mock('@/components/Explorer', async () => {
  const { useEffect, useRef } = await import('react')
  return {
    default: function NativeDropSurface() {
      const ref = useRef<HTMLDivElement>(null)
      useEffect(() => {
        const element = ref.current!
        // react-dnd installs native listeners on Explorer's own dndRootElement.
        // These run before React's delegated bubble listener on the outer root.
        element.addEventListener('dragover', nativeHandlers.dragover)
        element.addEventListener('drop', nativeHandlers.drop)
        return () => {
          element.removeEventListener('dragover', nativeHandlers.dragover)
          element.removeEventListener('drop', nativeHandlers.drop)
        }
      }, [])
      return <div ref={ref}><div data-testid='native-file-tree'>file tree</div></div>
    },
  }
})

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

beforeEach(() => {
  vi.clearAllMocks()
  clearDockDrag()
  useLayoutStore.setState(useLayoutStore.getInitialState())
})

afterEach(() => {
  cleanup()
  clearDockDrag()
})

function renderExplorerDock() {
  render(
    <ThemeProvider theme={desktopDarkTheme}>
      <TooltipProvider><DockPanelRenderer side='left' /></TooltipProvider>
    </ThemeProvider>,
  )
  return screen.getByTestId('native-file-tree')
}

function transfer(type: string, value: string): DataTransfer {
  return {
    types: [type],
    getData: (key: string) => key === type ? value : '',
    effectAllowed: 'move',
    dropEffect: 'none',
  } as unknown as DataTransfer
}

function dispatchDrag(target: HTMLElement, type: 'dragover' | 'drop', dataTransfer: DataTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  return fireEvent(target, event)
}

describe('Dock panel drop ownership', () => {
  it('rejects panel drags before Explorer native listeners can handle them', () => {
    const fileTree = renderExplorerDock()
    const dataTransfer = transfer(DOCK_PANEL_DRAG_TYPE, JSON.stringify({ panelId: 'toc' }))
    const layout = useLayoutStore.getState()
    dataTransfer.dropEffect = 'move'
    useDockDragStore.setState({ panelId: 'toc' })

    // A non-cancelled dragover keeps the content area from becoming a drop target.
    expect(dispatchDrag(fileTree, 'dragover', dataTransfer)).toBe(true)
    expect(dataTransfer.dropEffect).toBe('none')
    expect(nativeHandlers.dragover).not.toHaveBeenCalled()
    expect(useLayoutStore.getState()).toBe(layout)
    expect(useDockDragStore.getState().panelId).toBe('toc')
    expect(fileTree.closest('[data-mf-dock-panel]')?.classList.contains('mf-dock-drop-active')).toBe(false)
  })

  it('blocks a dispatched panel drop without moving panels and clears drag state', () => {
    const fileTree = renderExplorerDock()
    const dataTransfer = transfer(DOCK_PANEL_DRAG_TYPE, JSON.stringify({ panelId: 'toc' }))
    const layout = useLayoutStore.getState()
    dataTransfer.dropEffect = 'move'
    useDockDragStore.setState({ panelId: 'toc' })

    expect(dispatchDrag(fileTree, 'drop', dataTransfer)).toBe(false)
    expect(dataTransfer.dropEffect).toBe('none')
    expect(nativeHandlers.drop).not.toHaveBeenCalled()
    expect(useLayoutStore.getState()).toBe(layout)
    expect(useDockDragStore.getState().panelId).toBeNull()
    expect(screen.getByTestId('native-file-tree')).toBe(fileTree)
  })

  it.each(['Files', 'application/x-react-arborist', 'application/x-markflowy-editor-tab'])(
    'leaves %s drags available to native file-tree listeners',
    (type) => {
      const fileTree = renderExplorerDock()
      const dataTransfer = transfer(type, '{}')
      const panelOrder = useLayoutStore.getState().panelOrder

      expect(dispatchDrag(fileTree, 'dragover', dataTransfer)).toBe(true)
      expect(dispatchDrag(fileTree, 'drop', dataTransfer)).toBe(true)
      expect(nativeHandlers.dragover).toHaveBeenCalledOnce()
      expect(nativeHandlers.drop).toHaveBeenCalledOnce()
      expect(useLayoutStore.getState().panelOrder).toBe(panelOrder)
    },
  )
})
