import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useLayoutStore from '@/stores/useLayoutStore'
import useOpen from './useOpen'

const useOpenTestState = vi.hoisted(() => ({
  addRecentWorkspace: vi.fn(),
  confirm: vi.fn(),
  emitTo: vi.fn(),
  invoke: vi.fn(),
  openDialog: vi.fn(),
  switchWorkspace: vi.fn(),
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: useOpenTestState.invoke,
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: useOpenTestState.openDialog,
}))

vi.mock('@/helper/filesys', () => ({
  getFileNameFromPath: (path: string) => path.split('/').at(-1),
}))

vi.mock('@/helper/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/services/dialog', () => ({
  dialog: { confirm: useOpenTestState.confirm },
}))

vi.mock('@/services/editor-file', () => ({
  addExistingMarkdownFileEdit: vi.fn(),
}))

vi.mock('@/services/windows', () => ({
  currentWindow: { label: 'current-window', emitTo: useOpenTestState.emitTo },
}))

vi.mock('@/services/workspace-switch', () => ({
  OPEN_WORKSPACE_EXPLORER_EVENT: 'workspace:open-explorer',
  switchWorkspaceInCurrentWindow: useOpenTestState.switchWorkspace,
}))

vi.mock('@/stores/useOpenedCacheStore', () => ({
  default: () => ({ addRecentWorkspaces: useOpenTestState.addRecentWorkspace }),
}))

beforeEach(() => {
  useOpenTestState.addRecentWorkspace.mockReset().mockResolvedValue(undefined)
  useOpenTestState.confirm.mockReset()
  useOpenTestState.emitTo.mockReset().mockResolvedValue(undefined)
  useOpenTestState.invoke.mockReset()
  useOpenTestState.openDialog.mockReset()
  useOpenTestState.switchWorkspace.mockReset().mockResolvedValue(true)
  useLayoutStore.setState({
    leftBar: { activePanelId: 'search', size: 304, visible: false },
    rightBar: { activePanelId: 'ai', size: 336, visible: false },
    overlayDock: null,
    viewportMode: 'wide',
    zenModeActive: false,
  })
})

afterEach(cleanup)

describe('useOpen', () => {
  it('focuses an existing workspace window instead of switching the current window', async () => {
    useOpenTestState.invoke.mockImplementation(async (command: string) => {
      if (command === 'check_window_by_path') return 'notes-window'
      return undefined
    })
    const { result } = renderHook(() => useOpen())

    await act(async () => {
      await expect(result.current.openFolderInCurrentWindow('/workspaces/notes')).resolves.toBe(
        true,
      )
    })

    expect(useOpenTestState.invoke).toHaveBeenNthCalledWith(1, 'check_window_by_path', {
      path: '/workspaces/notes',
    })
    expect(useOpenTestState.invoke).toHaveBeenNthCalledWith(2, 'focus_window_by_label', {
      windowLabel: 'notes-window',
    })
    expect(useOpenTestState.addRecentWorkspace).toHaveBeenCalledWith({
      path: '/workspaces/notes',
    })
    expect(useOpenTestState.switchWorkspace).not.toHaveBeenCalled()
    expect(useOpenTestState.emitTo).toHaveBeenCalledWith('notes-window', 'workspace:open-explorer')
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
  })

  it('keeps the folder target confirmation on the shared current-window path', async () => {
    useOpenTestState.confirm.mockResolvedValue('currentWindow')
    useOpenTestState.invoke.mockResolvedValue(null)
    const { result } = renderHook(() => useOpen())

    await act(async () => {
      await result.current.openFolder('/workspaces/notes')
    })

    expect(useOpenTestState.confirm).toHaveBeenCalledTimes(1)
    expect(useOpenTestState.invoke).toHaveBeenCalledWith('check_window_by_path', {
      path: '/workspaces/notes',
    })
    expect(useOpenTestState.switchWorkspace).toHaveBeenCalledWith('/workspaces/notes')
  })

  it('reveals the file tree when reopening the current workspace', async () => {
    useOpenTestState.invoke.mockResolvedValue('current-window')
    const { result } = renderHook(() => useOpen())

    await act(async () => {
      await result.current.openFolderInCurrentWindow('/workspaces/notes')
    })

    expect(useLayoutStore.getState().leftBar).toEqual({
      activePanelId: 'explorer',
      size: 304,
      visible: true,
    })
    expect(useOpenTestState.switchWorkspace).not.toHaveBeenCalled()
    expect(useOpenTestState.emitTo).not.toHaveBeenCalled()
  })

  it('requests the file tree in the window returned by opening a folder in a new window', async () => {
    useOpenTestState.confirm.mockResolvedValue('newWindow')
    useOpenTestState.invoke.mockImplementation(async (command: string) =>
      command === 'create_new_window' ? 'notes-window' : true,
    )
    const { result } = renderHook(() => useOpen())

    await act(async () => {
      await result.current.openFolder('/workspaces/notes')
    })

    expect(useOpenTestState.emitTo).toHaveBeenCalledWith('notes-window', 'workspace:open-explorer')
    expect(useLayoutStore.getState().leftBar.visible).toBe(false)
  })
})
