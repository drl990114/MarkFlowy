import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Dropdown from '../../../../../packages/zens/src/Dropdown'
import Menu from '../../../../../packages/zens/src/Menu'
import Popover from '../../../../../packages/zens/src/Popover'
import { Toolbar, ToolbarButton } from '../../../../../packages/zens/src/components/toolbar'

afterEach(cleanup)

describe('shared Radix migration', () => {
  it('runs an action after the menu closes and preserves the action input focus', async () => {
    const user = userEvent.setup()
    function Example() {
      const [editing, setEditing] = useState(false)
      return (
        <>
          <Menu items={[{ label: 'Rename', value: 'rename', handler: () => setEditing(true) }]}>
            File actions
          </Menu>
          {editing && <input autoFocus aria-label='New name' />}
        </>
      )
    }
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'File actions' })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    const item = await screen.findByRole('menuitem', { name: 'Rename' })
    expect(screen.getByRole('menu').hasAttribute('data-mf-portal')).toBe(true)
    await user.click(item)
    const input = await screen.findByRole('textbox', { name: 'New name' })
    await waitFor(() => expect(document.activeElement).toBe(input))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('supports nested menu keyboard navigation and skips disabled items', async () => {
    const action = vi.fn()
    const user = userEvent.setup()
    render(
      <Menu
        items={[
          {
            label: 'Transform',
            value: 'transform',
            children: [
              { label: 'Unavailable', value: 'disabled', disabled: true, handler: action },
              { label: 'Heading', value: 'heading', handler: action },
            ],
          },
        ]}
      >
        Block actions
      </Menu>,
    )
    screen.getByRole('button', { name: 'Block actions' }).focus()
    await user.keyboard('{ArrowDown}')
    const submenu = await screen.findByRole('menuitem', { name: /Transform/ })
    submenu.focus()
    await user.keyboard('{ArrowRight}')
    const disabled = await screen.findByRole('menuitem', { name: 'Unavailable' })
    expect(disabled.getAttribute('aria-disabled')).toBe('true')
    const heading = screen.getByRole('menuitem', { name: 'Heading' })
    await waitFor(() => expect(document.activeElement).toBe(heading))
    await user.keyboard('{Enter}')
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes a controlled editor menu after an alignment toolbar action', async () => {
    const onAlign = vi.fn()
    const user = userEvent.setup()
    function Example() {
      const [open, setOpen] = useState(false)
      return (
        <Dropdown
          trigger={['click']}
          open={open}
          onOpenChange={setOpen}
          customTrigger={<button type='button'>Table actions</button>}
          menu={{
            items: [{ key: 'delete', label: 'Delete row' }],
            toolbar: {
              items: [{ key: 'center', label: 'Center', icon: <span aria-hidden>≡</span> }],
              onClick: onAlign,
            },
          }}
        />
      )
    }
    render(<Example />)
    await user.click(screen.getByRole('button', { name: 'Table actions' }))
    await user.click(await screen.findByRole('button', { name: 'Center' }))
    await waitFor(() => expect(onAlign).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('preserves a draggable editor control until click opens its anchored menu', async () => {
    const user = userEvent.setup()
    const drag = vi.fn()
    function Example() {
      const [open, setOpen] = useState(false)
      const anchor = useRef<HTMLButtonElement>(null)
      return (
        <Dropdown
          open={open}
          onOpenChange={setOpen}
          anchorElement={anchor.current}
          manualTrigger={
            <button
              ref={anchor}
              type='button'
              draggable
              onDragStart={drag}
              onClick={() => setOpen(true)}
            >
              Drag block
            </button>
          }
          menu={{ items: [{ key: 'delete', label: 'Delete block' }] }}
        />
      )
    }
    render(<Example />)
    const trigger = screen.getByRole('button', { name: 'Drag block' })
    fireEvent.pointerDown(trigger, { button: 0 })
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.dragStart(trigger)
    expect(drag).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    await user.click(trigger)
    expect(await screen.findByRole('menuitem', { name: 'Delete block' })).not.toBeNull()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('supports an initially open custom portal and semantic checked menu items', async () => {
    const user = userEvent.setup()
    const portal = document.createElement('div')
    document.body.appendChild(portal)
    try {
      render(
        <Menu
          defaultOpen
          getPopupContainer={() => portal}
          items={[{ label: 'Wrap lines', value: 'wrap', checked: true }]}
        >
          Editor options
        </Menu>,
      )
      const menu = await screen.findByRole('menu')
      await waitFor(() => expect(portal.contains(menu)).toBe(true))
      expect(
        screen.getByRole('menuitemcheckbox', { name: 'Wrap lines' }).getAttribute('aria-checked'),
      ).toBe('true')
      await user.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    } finally {
      portal.remove()
    }
  })

  it('keeps image-style popover inputs interactive and delegates Escape to Radix', async () => {
    const user = userEvent.setup()
    function Example() {
      const [open, setOpen] = useState(false)
      return (
        <Popover
          open={open}
          onOpenChange={setOpen}
          aria-label='Image actions'
          customContent={<input aria-label='Image description' />}
        >
          <span>Image</span>
        </Popover>
      )
    }
    render(<Example />)
    await user.click(screen.getByRole('button', { name: 'Image' }))
    const input = await screen.findByRole('textbox', { name: 'Image description' })
    await user.click(input)
    await user.type(input, 'Caption')
    expect(screen.getByRole('dialog').hasAttribute('data-mf-portal')).toBe(true)
    expect((input as HTMLInputElement).value).toBe('Caption')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps toolbar Arrow navigation and disabled item skipping', async () => {
    render(
      <Toolbar aria-label='Formatting'>
        <ToolbarButton>Bold</ToolbarButton>
        <ToolbarButton disabled>Unavailable</ToolbarButton>
        <ToolbarButton>Italic</ToolbarButton>
      </Toolbar>,
    )
    const bold = screen.getByRole('button', { name: 'Bold' })
    bold.focus()
    fireEvent.keyDown(bold, { key: 'ArrowRight' })
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Italic' })),
    )
  })
})
