import { TooltipProvider } from '@/components/ui/tooltip'
import { desktopDarkTheme } from '@markflowy/theme'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BoldIcon, XIcon } from 'lucide-react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getOverflowToolbarActions,
  ToolbarActionButton,
  toOverflowMenuItems,
  type ToolbarAction,
} from './ToolbarAction'

afterEach(cleanup)

function createAction(overrides: Partial<ToolbarAction> = {}): ToolbarAction {
  return {
    group: 'formatting',
    icon: BoldIcon,
    id: 'bold',
    label: 'Bold',
    priority: 50,
    run: vi.fn(),
    ...overrides,
  }
}

describe('toolbar overflow actions', () => {
  it('keeps only actions from hidden groups in their visual order', () => {
    const actions = [
      createAction({ id: 'undo', group: 'history', label: 'Undo' }),
      createAction(),
      createAction({ id: 'quote', group: 'blocks', label: 'Blockquote' }),
    ]

    expect(
      getOverflowToolbarActions(actions, new Set(['formatting', 'blocks'])).map(
        (action) => action.id,
      ),
    ).toEqual(['bold', 'quote'])
  })

  it('preserves the same command handler in the overflow menu', () => {
    const run = vi.fn()
    const [item] = toOverflowMenuItems([createAction({ run })])

    expect('type' in item).toBe(false)
    if ('type' in item) return

    item.handler?.()
    expect(item.value).toBe('toolbar-bold')
    expect(item.label).toBe('Bold')
    expect(run).toHaveBeenCalledOnce()
  })

  it('preserves disabled state when an action moves into overflow', () => {
    const [item] = toOverflowMenuItems([
      {
        id: 'disabled-action',
        group: 'format',
        priority: 1,
        label: 'Unavailable action',
        icon: XIcon,
        pressed: true,
        disabled: true,
        run: vi.fn(),
      },
    ])

    expect(item).toMatchObject({
      checked: true,
      disabled: true,
      value: 'toolbar-disabled-action',
    })
  })

  it('uses the shared 22px chrome contract with a 14px Lucide SVG', () => {
    const run = vi.fn()

    const { container } = render(
      <ThemeProvider theme={desktopDarkTheme}>
        <TooltipProvider>
          <ToolbarActionButton action={createAction({ run })} />
        </TooltipProvider>
      </ThemeProvider>,
    )

    const button = screen.getByRole('button', { name: 'Bold' })
    expect(button.className).toContain('size-[22px]')
    expect(button.className).toContain('[&_svg]:size-3.5')
    expect(button.className).toContain('text-content-secondary')
    expect(button.className).toContain('hover:text-content-primary')
    expect(button.className).toContain('active:bg-control-ghost-pressed')
    expect(button.className).toContain('aria-pressed:text-primary')
    expect(button.hasAttribute('aria-pressed')).toBe(false)

    const icon = button.querySelector('svg')
    expect(icon?.getAttribute('width')).toBe('14')
    expect(icon?.getAttribute('height')).toBe('14')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('i')).toBeNull()

    fireEvent.click(button)
    expect(run).toHaveBeenCalledOnce()
  })

  it('exposes toggle state and preserves native disabled semantics', () => {
    const run = vi.fn()

    render(
      <ThemeProvider theme={desktopDarkTheme}>
        <TooltipProvider>
          <ToolbarActionButton
            action={createAction({ disabled: true, pressed: true, run })}
          />
        </TooltipProvider>
      </ThemeProvider>,
    )

    const button = screen.getByRole('button', { name: 'Bold' }) as HTMLButtonElement
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.disabled).toBe(true)

    fireEvent.click(button)
    expect(run).not.toHaveBeenCalled()
  })
})
