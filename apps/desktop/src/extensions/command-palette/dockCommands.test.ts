import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useLayoutStore, { DEFAULT_DOCK_PANEL_ORDER, getDockPanelSide, type DockPanelId } from '@/stores/useLayoutStore'
import { registerOutlineCommands } from '@/components/TableOfContent/outlineCommands'
import { EditorViewType } from '@/constants/editorViewType'
import { paletteCommands, type CommandPaletteContext } from './paletteCommands'

const editorTarget = vi.hoisted(() => ({ current: true }))
vi.mock('@/components/LocalHistory/historyDialogStore', () => ({ openLocalHistory: vi.fn() }))
vi.mock('@/components/EditorArea/focusActiveEditor', () => ({ focusActiveEditor: vi.fn() }))
vi.mock('@/components/EditorArea/editorSearchStore', () => ({ openDocumentSearch: vi.fn() }))
vi.mock('./editorCommands', () => ({
  EDITOR_COMMANDS: [],
  editorCommandUnavailable: vi.fn(),
  executeEditorPaletteCommand: vi.fn(),
  isCurrentCommandTarget: () => editorTarget.current,
}))

const context: CommandPaletteContext = { target: null, platform: 'linux' }
const allPanels: DockPanelId[] = ['explorer', 'search', 'bookmarks', 'toc', 'ai']
const disposals: (() => void)[] = []
const command = (id: string) => paletteCommands.find((item) => item.id === id)!

beforeEach(() => {
  editorTarget.current = true
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
  useLayoutStore.setState({
    panelOrder: { left: [...DEFAULT_DOCK_PANEL_ORDER.left], right: [...DEFAULT_DOCK_PANEL_ORDER.right] },
    hasWorkspace: true,
    workspaceDocks: undefined,
    documentDocks: {
      leftBar: { activePanelId: 'bookmarks', size: 240, visible: false },
      rightBar: { activePanelId: 'toc', size: 280, visible: false },
    },
    leftBar: { activePanelId: 'explorer', size: 300, visible: true },
    rightBar: { activePanelId: 'toc', size: 330, visible: true },
    leftStartup: 'restore',
    rightStartup: 'restore',
    zenModeActive: false,
  })
})

afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose())
  vi.restoreAllMocks()
})

describe('Dock palette commands', () => {
  it.each(allPanels)('moves %s to its opposite side using its current assignment', async (panelId) => {
    const move = command(`app_moveDockPanel_${panelId}`)
    const initialSide = getDockPanelSide(useLayoutStore.getState().panelOrder, panelId)!
    const targetSide = initialSide === 'left' ? 'right' : 'left'
    expect(move.getUnavailableReason(context)).toBeUndefined()
    expect(await move.execute(context)).toBe(true)
    expect(getDockPanelSide(useLayoutStore.getState().panelOrder, panelId)).toBe(targetSide)
    expect(useLayoutStore.getState()[targetSide === 'left' ? 'leftBar' : 'rightBar']).toMatchObject({
      activePanelId: panelId, visible: true,
    })
    expect(await move.execute(context)).toBe(true)
    expect(getDockPanelSide(useLayoutStore.getState().panelOrder, panelId)).toBe(initialSide)
  })

  it('restores default placement through the palette while retaining side widths', async () => {
    await command('app_moveDockPanel_toc').execute(context)
    await command('app_moveDockPanel_bookmarks').execute(context)
    const reset = command('app_resetDockLayout')
    expect(reset.getUnavailableReason(context)).toBeUndefined()
    expect(await reset.execute(context)).toBe(true)
    expect(useLayoutStore.getState().panelOrder).toEqual(DEFAULT_DOCK_PANEL_ORDER)
    expect(useLayoutStore.getState().leftBar).toMatchObject({ activePanelId: 'explorer', size: 300 })
    expect(useLayoutStore.getState().rightBar).toMatchObject({ activePanelId: 'toc', size: 330 })
  })

  it('rejects workspace panel commands in document mode and keeps document tools available', async () => {
    useLayoutStore.getState().setWorkspaceContext(false)
    for (const panelId of ['explorer', 'search']) {
      const move = command(`app_moveDockPanel_${panelId}`)
      const before = useLayoutStore.getState()
      expect(move.getUnavailableReason(context)).toBe('unavailable')
      expect(await move.execute(context)).toBe(false)
      expect(useLayoutStore.getState()).toBe(before)
    }
    for (const panelId of ['toc', 'bookmarks', 'ai']) {
      const move = command(`app_moveDockPanel_${panelId}`)
      expect(move.getUnavailableReason(context)).toBeUndefined()
      expect(await move.execute(context)).toBe(true)
    }
  })

  it('rechecks document availability when executing a command shown before context changed', async () => {
    const move = command('app_moveDockPanel_explorer')
    expect(move.getUnavailableReason(context)).toBeUndefined()
    useLayoutStore.getState().setWorkspaceContext(false)
    const before = useLayoutStore.getState().panelOrder
    expect(await move.execute(context)).toBe(false)
    expect(useLayoutStore.getState().panelOrder).toBe(before)
  })

  it('blocks both movement and reset during Zen Mode without changing the saved layout', async () => {
    useLayoutStore.getState().moveDockPanel('toc', 'left')
    useLayoutStore.getState().setZenModeActive(true)
    const before = useLayoutStore.getState()
    for (const id of [...allPanels.map((panelId) => `app_moveDockPanel_${panelId}`), 'app_resetDockLayout']) {
      expect(command(id).getUnavailableReason(context)).toBe('zen_mode')
      expect(await command(id).execute(context)).toBe(false)
    }
    expect(useLayoutStore.getState()).toBe(before)
  })
})

describe('relocated outline palette commands', () => {
  const outlineContext: CommandPaletteContext = {
    target: { fileId: 'file', mode: EditorViewType.WYSIWYG }, platform: 'linux',
  }

  it('executes outline actions on the left and rejects them while the outline is hidden', async () => {
    const collapseAll = vi.fn()
    const expandAll = vi.fn()
    disposals.push(registerOutlineCommands({ isCurrent: () => true, collapseAll, expandAll }))
    useLayoutStore.getState().moveDockPanel('toc', 'left')
    for (const [id, handler] of [
      ['app_outlineCollapseAll', collapseAll], ['app_outlineExpandAll', expandAll],
    ] as const) {
      expect(command(id).getUnavailableReason(outlineContext)).toBeUndefined()
      expect(await command(id).execute(outlineContext)).toBe(true)
      expect(handler).toHaveBeenCalledOnce()
    }
    useLayoutStore.getState().setLeftBarVisible(false)
    for (const id of ['app_outlineCollapseAll', 'app_outlineExpandAll']) {
      expect(command(id).getUnavailableReason(outlineContext)).toBe('unavailable')
      expect(await command(id).execute(outlineContext)).toBe(false)
    }
    expect(collapseAll).toHaveBeenCalledOnce()
    expect(expandAll).toHaveBeenCalledOnce()
  })

  it('guards missing documents, stale targets and Zen Mode before invoking the outline', async () => {
    const collapseAll = vi.fn()
    disposals.push(registerOutlineCommands({ isCurrent: () => true, collapseAll, expandAll: vi.fn() }))
    const collapse = command('app_outlineCollapseAll')
    expect(collapse.getUnavailableReason(context)).toBe('no_document')
    expect(await collapse.execute(context)).toBe(false)
    editorTarget.current = false
    expect(collapse.getUnavailableReason(outlineContext)).toBe('stale_target')
    expect(await collapse.execute(outlineContext)).toBe(false)
    editorTarget.current = true
    useLayoutStore.getState().setZenModeActive(true)
    expect(collapse.getUnavailableReason(outlineContext)).toBe('unavailable')
    expect(await collapse.execute(outlineContext)).toBe(false)
    expect(collapseAll).not.toHaveBeenCalled()
  })
})
