import { TooltipProvider } from '@/components/ui/tooltip'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { EditorContext } from 'rme'
import { describe, expect, it, vi } from 'vitest'
import { HeadingNumberingButton } from './HeadingNumberingButton'

vi.mock('@/commands', () => ({
  commandRegistry: { execute: vi.fn() },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('HeadingNumberingButton', () => {
  it('reflects the heading-numbering toggle state and command result', () => {
    let complete = false
    let handleEditorUpdate: (() => void) | undefined
    const applyHeadingNumbering = vi.fn(() => {
      complete = true
      return true
    })
    const removeHeadingNumbering = vi.fn(() => {
      complete = false
      return true
    })
    const focus = vi.fn()
    const unsubscribe = vi.fn()
    const editorCtx = {
      addHandler: vi.fn((event: string, handler: () => void) => {
        expect(event).toBe('updated')
        handleEditorUpdate = handler
        return unsubscribe
      }),
      commands: { applyHeadingNumbering, removeHeadingNumbering },
      helpers: { getHeadingNumbering: () => ({ complete }) },
      view: { focus },
    } as unknown as EditorContext

    render(
      <TooltipProvider>
        <HeadingNumberingButton editorCtx={editorCtx} />
      </TooltipProvider>,
    )

    const button = screen.getByRole('button', { name: 'sidebar.heading_numbering' })
    expect(button.getAttribute('aria-pressed')).toBe('false')

    complete = true
    act(() => handleEditorUpdate?.())
    expect(button.getAttribute('aria-pressed')).toBe('true')

    complete = false
    act(() => handleEditorUpdate?.())
    expect(button.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(button)
    expect(applyHeadingNumbering).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(button)
    expect(removeHeadingNumbering).toHaveBeenCalledTimes(1)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(focus).toHaveBeenCalledTimes(2)
  })
})
