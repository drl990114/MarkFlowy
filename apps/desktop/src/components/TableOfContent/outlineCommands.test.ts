import { afterEach, describe, expect, it, vi } from 'vitest'
import { commandRegistry } from '@/commands'
import useLayoutStore from '@/stores/useLayoutStore'
import {
  isOutlineCommandAvailable, OUTLINE_COLLAPSE_ALL, OUTLINE_EXPAND_ALL, registerOutlineCommands,
} from './outlineCommands'

const initialLayout = useLayoutStore.getState()
const disposers: (() => void)[] = []
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose())
  useLayoutStore.setState(initialLayout)
})

describe('outline command availability', () => {
  it('executes only for a current outline visible on either dock', async () => {
    const collapseAll = vi.fn()
    const expandAll = vi.fn()
    const isCurrent = vi.fn(() => true)
    disposers.push(registerOutlineCommands({ isCurrent, collapseAll, expandAll }))
    useLayoutStore.setState({
      zenModeActive: false,
      leftBar: { ...initialLayout.leftBar, visible: false, activePanelId: null },
      rightBar: { ...initialLayout.rightBar, visible: true, activePanelId: 'toc' },
    })
    expect(isOutlineCommandAvailable()).toBe(true)
    await commandRegistry.execute(OUTLINE_COLLAPSE_ALL)
    expect(collapseAll).toHaveBeenCalledOnce()
    useLayoutStore.setState({
      rightBar: { ...initialLayout.rightBar, visible: false, activePanelId: null },
      leftBar: { ...initialLayout.leftBar, visible: true, activePanelId: 'toc' },
    })
    await commandRegistry.execute(OUTLINE_EXPAND_ALL)
    expect(expandAll).toHaveBeenCalledOnce()
    isCurrent.mockReturnValue(false)
    expect(isOutlineCommandAvailable()).toBe(false)
    await commandRegistry.execute(OUTLINE_COLLAPSE_ALL)
    expect(collapseAll).toHaveBeenCalledOnce()
    isCurrent.mockReturnValue(true)
    useLayoutStore.setState({ zenModeActive: true })
    expect(isOutlineCommandAvailable()).toBe(false)
    useLayoutStore.setState({ zenModeActive: false, leftBar: { ...initialLayout.leftBar, visible: true, activePanelId: 'bookmarks' } })
    expect(isOutlineCommandAvailable()).toBe(false)
    expect(isOutlineCommandAvailable('app_save')).toBe(false)
  })

  it('unregisters the controller when its outline unmounts', () => {
    const dispose = registerOutlineCommands({ isCurrent: () => true, collapseAll: vi.fn(), expandAll: vi.fn() })
    dispose()
    expect(isOutlineCommandAvailable()).toBe(false)
    expect(commandRegistry.hasCommand(OUTLINE_COLLAPSE_ALL)).toBe(false)
  })

  it('keeps a replacement controller registered when the previous mount cleans up late', () => {
    const previous = registerOutlineCommands({ isCurrent: () => true, collapseAll: vi.fn(), expandAll: vi.fn() })
    const next = registerOutlineCommands({ isCurrent: () => true, collapseAll: vi.fn(), expandAll: vi.fn() })
    disposers.push(next)
    previous()
    expect(commandRegistry.hasCommand(OUTLINE_COLLAPSE_ALL)).toBe(true)
  })
})
