import useContextMenuStore from '@/stores/useContextMenuStore'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContextMenu, hideContextMenu, showContextMenu } from './ContextMenu'

const commandMocks = vi.hoisted(() => ({
  execute: vi.fn(),
  formatKeybinding: vi.fn(() => '⌘K'),
}))

vi.mock('@/commands', () => ({
  commandRegistry: { execute: commandMocks.execute },
  keybindingRegistry: { formatKeybinding: commandMocks.formatKeybinding },
}))

afterEach(() => {
  hideContextMenu()
  commandMocks.execute.mockReset()
  commandMocks.formatKeybinding.mockClear()
  cleanup()
})

describe('imperative ContextMenu compatibility', () => {
  it('renders checked, nested, divider and command-backed items with the Radix facade', async () => {
    render(<ContextMenu />)

    act(() => {
      showContextMenu({
        x: 120,
        y: 80,
        items: [
          { checked: true, label: 'Pinned', value: 'pinned' },
          { type: 'divider' },
          {
            children: [{ label: 'Child action', value: 'child' }],
            label: 'More',
            value: 'more',
          },
          { commandId: 'test_command', label: 'Run command', value: 'run' },
        ],
      })
    })

    const menu = await screen.findByRole('menu', { name: 'Context menu' })
    expect(menu.hasAttribute('data-mf-portal')).toBe(true)
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Pinned' }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.getByRole('separator')).not.toBeNull()
    const moreItem = screen.getByRole('menuitem', { name: /More/ })
    expect(moreItem).not.toBeNull()
    expect(screen.getByText('⌘K')).not.toBeNull()

    moreItem.focus()
    fireEvent.keyDown(moreItem, { key: 'ArrowRight' })
    expect(await screen.findByRole('menuitem', { name: 'Child action' })).not.toBeNull()

    fireEvent.click(screen.getByRole('menuitem', { name: /Run command/ }))
    expect(commandMocks.execute).toHaveBeenCalledWith('test_command')
    await waitFor(() => expect(useContextMenuStore.getState().open).toBe(false))
  })

  it('closes through Radix Escape handling and keeps the imperative store in sync', async () => {
    render(<ContextMenu />)

    act(() => {
      showContextMenu({
        x: 24,
        y: 32,
        items: [{ label: 'Rename', value: 'rename' }],
      })
    })

    const menu = await screen.findByRole('menu')
    const trigger = document.querySelector<HTMLElement>("[data-slot='context-menu-trigger']")
    expect(trigger?.style.left).toBe('24px')
    expect(trigger?.style.top).toBe('32px')

    fireEvent.keyDown(menu, { key: 'Escape' })
    await waitFor(() => expect(useContextMenuStore.getState().open).toBe(false))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('keeps disabled overflow actions unfocusable and does not dismiss the menu', async () => {
    const handler = vi.fn()
    render(<ContextMenu />)

    act(() => {
      showContextMenu({
        x: 12,
        y: 16,
        items: [{ disabled: true, handler, label: 'Unavailable action', value: 'disabled' }],
      })
    })

    const item = await screen.findByRole('menuitem', { name: 'Unavailable action' })
    expect(item.getAttribute('data-disabled')).not.toBeNull()
    fireEvent.click(item)
    expect(handler).not.toHaveBeenCalled()
    expect(useContextMenuStore.getState().open).toBe(true)
  })
})
