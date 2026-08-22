import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './context-menu'

afterEach(cleanup)

describe('ContextMenu facade', () => {
  it('portals semantic menu content and delegates Escape dismissal to Radix', async () => {
    render(
      <ContextMenu>
        <ContextMenuTrigger>Open</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Rename</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>,
    )

    fireEvent.contextMenu(screen.getByText('Open'), { clientX: 36, clientY: 48 })

    const menu = await screen.findByRole('menu')
    expect(menu.hasAttribute('data-mf-portal')).toBe(true)
    expect(menu.getAttribute('data-slot')).toBe('context-menu-content')
    expect(menu.className).toContain('z-[var(--mf-layer-menu)]')
    expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toBeNull()

    fireEvent.keyDown(menu, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })
})
