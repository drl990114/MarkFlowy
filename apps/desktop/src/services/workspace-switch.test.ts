import useLayoutStore from '@/stores/useLayoutStore'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setWorkspaceSwitchHandler, switchWorkspaceInCurrentWindow } from './workspace-switch'

describe('workspace switch service', () => {
  beforeEach(() => {
    useLayoutStore.setState({
      leftBar: { activePanelId: 'search', size: 304, visible: false },
      rightBar: { activePanelId: 'ai', size: 336, visible: false },
      overlayDock: null,
      viewportMode: 'wide',
      zenModeActive: false,
    })
  })

  afterEach(() => {
    setWorkspaceSwitchHandler()
  })

  it('delegates to the active workspace persistence runtime', async () => {
    const handler = vi.fn().mockResolvedValue(true)
    setWorkspaceSwitchHandler(handler)

    await expect(switchWorkspaceInCurrentWindow('/workspace')).resolves.toBe(true)
    expect(handler).toHaveBeenCalledWith('/workspace')
  })

  it('rejects while workspace persistence is unavailable', async () => {
    await expect(switchWorkspaceInCurrentWindow('/workspace')).rejects.toThrow(
      'Workspace persistence is not ready',
    )
  })

  it('serializes concurrent workspace switches in request order', async () => {
    let finishFirst: (() => void) | undefined
    const calls: string[] = []
    const handler = vi.fn(async (path: string) => {
      calls.push(path)
      if (path === '/first') {
        await new Promise<void>((resolve) => {
          finishFirst = resolve
        })
      }
      return true
    })
    setWorkspaceSwitchHandler(handler)

    const first = switchWorkspaceInCurrentWindow('/first')
    const second = switchWorkspaceInCurrentWindow('/second')
    await vi.waitFor(() => expect(calls).toEqual(['/first']))

    finishFirst?.()
    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
    expect(calls).toEqual(['/first', '/second'])
  })

  it('opens the file tree once after a successful switch and allows it to be closed afterward', async () => {
    let finishSwitch!: (didSwitch: boolean) => void
    setWorkspaceSwitchHandler(
      () =>
        new Promise((resolve) => {
          finishSwitch = resolve
        }),
    )

    const switching = switchWorkspaceInCurrentWindow('/workspace')
    await vi.waitFor(() => expect(finishSwitch).toBeTypeOf('function'))
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)

    finishSwitch(true)
    await switching
    expect(useLayoutStore.getState().leftBar).toEqual({
      activePanelId: 'explorer',
      size: 304,
      visible: true,
    })
    expect(useLayoutStore.getState().rightBar).toEqual({
      activePanelId: 'ai',
      size: 336,
      visible: false,
    })

    useLayoutStore.getState().setLeftBarVisible(false)
    await Promise.resolve()
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
  })

  it.each(['cancelled', 'failed'])(
    'keeps the sidebars unchanged when a switch is %s',
    async (outcome) => {
      setWorkspaceSwitchHandler(async () => {
        if (outcome === 'failed') throw new Error('Workspace unavailable')
        return false
      })
      const previous = useLayoutStore.getState()

      const switching = switchWorkspaceInCurrentWindow('/workspace')
      if (outcome === 'failed') await expect(switching).rejects.toThrow('Workspace unavailable')
      else await expect(switching).resolves.toBe(false)

      expect(useLayoutStore.getState()).toBe(previous)
    },
  )

  it('reveals the left overlay when a folder opens in a compact window', async () => {
    useLayoutStore.getState().setViewportMode('compact')
    useLayoutStore.getState().setOverlayDock('right')
    setWorkspaceSwitchHandler(async () => true)

    await switchWorkspaceInCurrentWindow('/workspace')

    expect(useLayoutStore.getState().overlayDock).toBe('left')
    expect(useLayoutStore.getState().leftBar.activePanelId).toBe('explorer')
  })
})
