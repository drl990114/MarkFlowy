import { TooltipProvider } from '@/components/ui/tooltip'
import { flushDraftProtection, useHistoryProtection } from '@/services/local-history'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DraftProtectionStatus } from './DraftProtectionStatus'

vi.mock('@/services/local-history', async () => {
  const { create } = await import('zustand')
  return {
    flushDraftProtection: vi.fn(),
    useHistoryProtection: create(() => ({
      status: {} as Record<string, 'pending' | 'protected' | 'failed'>,
      paused: {} as Record<string, boolean>,
      revision: 0,
    })),
  }
})

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'history.failed': 'Draft protection failed',
        'history.paused': 'Restored draft · save manually',
        'history.retry': 'Retry protection',
      })[key] ?? key,
  }),
}))

const retryName = 'Draft protection failed · Retry protection'

function renderStatus(fileId = 'file') {
  return render(
    <TooltipProvider>
      <DraftProtectionStatus fileId={fileId} />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  useHistoryProtection.setState({ status: {}, paused: {} })
  vi.mocked(flushDraftProtection).mockReset().mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('DraftProtectionStatus', () => {
  it('keeps normal protection and failures in other documents out of the header', () => {
    useHistoryProtection.setState({ status: { other: 'failed' } })
    const { container } = renderStatus()
    expect(container.textContent).toBe('')
    for (const status of ['pending', 'protected'] as const) {
      act(() => useHistoryProtection.setState({ status: { file: status, other: 'failed' } }))
      expect(screen.queryByRole('button')).toBeNull()
      expect(screen.queryByRole('status')).toBeNull()
    }
  })

  it('shows the explanation on keyboard focus without taking focus when a failure arrives', () => {
    render(
      <TooltipProvider>
        <textarea aria-label='Editor' />
        <DraftProtectionStatus fileId='file' />
      </TooltipProvider>,
    )
    const editor = screen.getByRole('textbox', { name: 'Editor' })
    act(() => editor.focus())
    act(() => useHistoryProtection.setState({ status: { file: 'failed' } }))
    expect(document.activeElement).toBe(editor)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('tooltip')).toBeNull()

    const retry = screen.getByRole('button', { name: retryName })
    expect(retry.textContent).toBe('')
    act(() => retry.focus())
    const tooltip = screen.getByRole('tooltip')
    expect(tooltip.textContent).toContain('Draft protection failed')
    expect(tooltip.textContent).toContain('Retry protection')
    expect(retry.getAttribute('aria-describedby')).toBe(tooltip.id)
    fireEvent.keyDown(retry, { key: 'Escape' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('retries only the current document and keeps the action available after rejection', async () => {
    useHistoryProtection.setState({ status: { file: 'failed', other: 'failed' } })
    vi.mocked(flushDraftProtection).mockRejectedValueOnce(new Error('Disk unavailable'))
    renderStatus()
    const retry = screen.getByRole('button', { name: retryName })
    await act(async () => fireEvent.click(retry))
    expect(flushDraftProtection).toHaveBeenCalledExactlyOnceWith('file')
    expect(screen.getByRole('button', { name: retryName })).toBe(retry)

    vi.mocked(flushDraftProtection).mockImplementationOnce(async (fileId) => {
      useHistoryProtection.setState({ status: { [fileId!]: 'protected', other: 'failed' } })
    })
    await act(async () => fireEvent.click(retry))
    expect(flushDraftProtection).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('retains the manual-save reminder for restored drafts after protection succeeds', async () => {
    useHistoryProtection.setState({ status: { file: 'failed' }, paused: { file: true } })
    vi.mocked(flushDraftProtection).mockImplementationOnce(async () => {
      useHistoryProtection.setState({ status: { file: 'protected' } })
    })
    renderStatus()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: retryName })))
    expect(useHistoryProtection.getState().paused.file).toBe(true)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Restored draft · save manually')).toBeDefined()
  })
})
