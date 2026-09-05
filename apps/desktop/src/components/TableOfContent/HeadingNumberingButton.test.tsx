import { TooltipProvider } from '@/components/ui/tooltip'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { EditorContext } from 'rme'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CapricornHeadingNumberingButton, HeadingNumberingButton } from './HeadingNumberingButton'

import type {
  CapricornHeading,
  CapricornRuntimeAdapter,
} from '../EditorArea/capricornRuntimeAdapter'
import { commandRegistry } from '@/commands'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

vi.mock('@/commands', () => ({
  commandRegistry: { execute: vi.fn() },
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('HeadingNumberingButton', () => {
  it('stays hidden while the source editor context is being replaced', () => {
    const editorCtx = {
      addHandler: vi.fn(),
      commands: {},
      helpers: {},
      view: { focus: vi.fn() },
    } as unknown as EditorContext

    render(
      <TooltipProvider>
        <HeadingNumberingButton editorCtx={editorCtx} />
      </TooltipProvider>,
    )

    expect(screen.queryByRole('button', { name: 'sidebar.heading_numbering' })).toBeNull()
    expect(editorCtx.addHandler).not.toHaveBeenCalled()
  })

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

describe('CapricornHeadingNumberingButton', () => {
  it('uses published numbering snapshots and retains current command and editor state', () => {
    let notify: ((headings: CapricornHeading[]) => void) | undefined
    let complete = false
    const getNumbering = vi.fn(() => ({ complete, hasHeadings: true }))
    const focus = vi.fn()
    const unsubscribe = vi.fn()
    const sample = (number: string | null): CapricornHeading[] => [
      { id: 'h', level: 1, text: 'Heading', title: 'Heading', number },
    ]
    const applyNumbering = vi.fn(() => {
      complete = true
      notify!(sample('1'))
      return { complete, hasHeadings: true }
    })
    const removeNumbering = vi.fn(() => {
      complete = false
      notify!(sample(null))
      return { complete, hasHeadings: true }
    })
    const editor = {
      focus,
      headings: {
        getNumbering,
        applyNumbering,
        removeNumbering,
        subscribe: (listener: typeof notify) => {
          notify = listener
          return unsubscribe
        },
      },
    } as unknown as CapricornRuntimeAdapter
    const view = render(
      <TooltipProvider>
        <CapricornHeadingNumberingButton editor={editor} />
      </TooltipProvider>,
    )
    const button = screen.getByRole('button', { name: 'sidebar.heading_numbering' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    getNumbering.mockClear()
    act(() => {
      complete = true
      notify!(sample('1'))
    })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    act(() => {
      complete = false
      notify!(sample(null))
    })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(getNumbering).not.toHaveBeenCalled()
    fireEvent.click(button)
    expect(applyNumbering).toHaveBeenCalledOnce()
    expect(button.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(button)
    expect(removeNumbering).toHaveBeenCalledOnce()
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(getNumbering).toHaveBeenCalledTimes(2)
    expect(commandRegistry.execute).not.toHaveBeenCalled()
    expect(focus).toHaveBeenCalledTimes(2)
    const nextGetNumbering = vi.fn(() => ({ complete: true, hasHeadings: true }))
    const nextEditor = {
      headings: { getNumbering: nextGetNumbering, subscribe: () => () => {} },
    } as unknown as CapricornRuntimeAdapter
    view.rerender(
      <TooltipProvider>
        <CapricornHeadingNumberingButton editor={nextEditor} />
      </TooltipProvider>,
    )
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(nextGetNumbering).toHaveBeenCalledOnce()
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })
})
