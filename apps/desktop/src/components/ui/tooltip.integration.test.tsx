import { desktopLightTheme } from '@markflowy/theme'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createRef, type ReactNode } from 'react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Input from '../../../../../packages/zens/src/Input'
import SharedTooltip from '../../../../../packages/zens/src/Tooltip'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

function TooltipTestProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={desktopLightTheme}>
      <TooltipProvider>{children}</TooltipProvider>
    </ThemeProvider>
  )
}

const renderTooltips = (children: ReactNode) => render(children, { wrapper: TooltipTestProviders })

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('shared and Desktop Radix tooltips', () => {
  it('waits 100ms for both implementations when moving between triggers', async () => {
    vi.useFakeTimers()
    renderTooltips(
      <>
        <Tooltip>
          <TooltipTrigger>Desktop</TooltipTrigger>
          <TooltipContent>Desktop hint</TooltipContent>
        </Tooltip>
        <SharedTooltip title='Shared hint'>
          <button type='button'>Shared</button>
        </SharedTooltip>
      </>,
    )

    for (const name of ['Desktop', 'Shared', 'Desktop']) {
      const trigger = screen.getByRole('button', { name })
      fireEvent.pointerMove(trigger, { pointerType: 'mouse' })
      await act(() => vi.advanceTimersByTimeAsync(99))
      expect(screen.queryByRole('tooltip')).toBeNull()
      await act(() => vi.advanceTimersByTimeAsync(1))
      expect(screen.getByRole('tooltip').textContent).toBe(`${name} hint`)
      expect(trigger.getAttribute('data-state')).toBe('delayed-open')
      fireEvent.pointerLeave(trigger, { pointerType: 'mouse' })
      fireEvent.keyDown(trigger, { key: 'Escape' })
      expect(screen.queryByRole('tooltip')).toBeNull()
    }
  })

  it('keeps controlled validation content and both input refs connected', () => {
    const inputRef = createRef<HTMLInputElement>()
    const radixRef = createRef<HTMLInputElement>()
    const onChange = vi.fn()
    const { rerender, unmount } = renderTooltips(
      <SharedTooltip title='Invalid name' open placement='right-start'>
        <Input ref={radixRef} inputRef={inputRef} aria-label='Name' onChange={onChange} />
      </SharedTooltip>,
    )
    const input = screen.getByRole('textbox', { name: 'Name' })
    expect(inputRef.current).toBe(input)
    expect(radixRef.current).toBe(input)
    expect(inputRef.current?.type).toBe('text')
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id)
    expect(
      document.querySelector('[data-slot="tooltip-content"]')?.getAttribute('data-side'),
    ).toBe('right')
    fireEvent.change(input, { target: { value: 'new.md' } })
    expect(onChange).toHaveBeenCalledOnce()

    rerender(
      <SharedTooltip title='Invalid name' open={false}>
        <Input ref={radixRef} inputRef={inputRef} aria-label='Name' />
      </SharedTooltip>,
    )
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Name' })).toBe(input)
    unmount()
    expect(inputRef.current).toBeNull()
    expect(radixRef.current).toBeNull()
  })

  it('keeps legacy non-button triggers keyboard focusable and preserves explicit tab order', () => {
    renderTooltips(
      <>
        <SharedTooltip title='Legacy hint'>
          <i aria-label='Legacy icon' />
        </SharedTooltip>
        <SharedTooltip title='Programmatic hint'>
          <div aria-label='Programmatic trigger' tabIndex={-1} />
        </SharedTooltip>
      </>,
    )
    const trigger = screen.getByLabelText('Legacy icon')
    expect(trigger.tabIndex).toBe(0)
    expect(screen.getByLabelText('Programmatic trigger').tabIndex).toBe(-1)
    fireEvent.focus(trigger)
    expect(screen.getByRole('tooltip').textContent).toBe('Legacy hint')
    fireEvent.keyDown(trigger, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('supports keyboard focus for a disabled trigger and portals into a supplied container', () => {
    const container = document.createElement('div')
    document.body.append(container)
    try {
      renderTooltips(
        <SharedTooltip title='Unavailable' container={container}>
          <button type='button' disabled>
            Action
          </button>
        </SharedTooltip>,
      )
      const trigger = screen.getByLabelText('Unavailable')
      expect(trigger.tabIndex).toBe(0)
      fireEvent.focus(trigger)
      expect(container.contains(screen.getByRole('tooltip'))).toBe(true)
      expect(container.querySelector('[data-mf-portal]')).not.toBeNull()
      fireEvent.keyDown(trigger, { key: 'Escape' })
      expect(screen.queryByRole('tooltip')).toBeNull()
    } finally {
      container.remove()
    }
  })
})
