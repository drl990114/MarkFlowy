import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useAppSettingStore from '@/stores/useAppSettingStore'
import { HistorySetting } from '.'

const mocks = vi.hoisted(() => ({ history: vi.fn(), write: vi.fn(), changed: vi.fn() }))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/services/app-setting', () => ({ default: { writeSettingData: mocks.write } }))
vi.mock('@/services/local-history', () => ({
  historyCall: mocks.history,
  historyChanged: mocks.changed,
  historyWorkspace: () => '/workspace-a',
  useHistoryProtection: () => 0,
}))
beforeEach(() => {
  vi.clearAllMocks()
  useAppSettingStore.setState({ settingData: {} })
  mocks.history.mockResolvedValue({ count: 12, reclaimableBytes: 2048, enabled: true })
  mocks.write.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('local history settings', () => {
  it('defaults to enabled and only changes the history setting', async () => {
    render(<HistorySetting />)
    const toggle = screen.getByRole('switch')
    expect(toggle.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(toggle)
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith({ key: 'local_history_enabled' }, false),
    )
    expect(mocks.history.mock.calls.some(([op]) => op === 'clear' || op === 'finishDraft')).toBe(
      false,
    )
  })
  it.each([
    ['history.clear_workspace', '/workspace-a'],
    ['history.clear_all', undefined],
  ])('confirms %s and clears exactly the chosen scope', async (label, workspace) => {
    render(<HistorySetting />)
    fireEvent.click(screen.getByRole('button', { name: label }))
    await screen.findByRole('dialog')
    expect(mocks.history.mock.calls.some(([op]) => op === 'clear')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'history.delete' }))
    await waitFor(() => expect(mocks.history).toHaveBeenCalledWith('clear', { workspace }))
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('cancelling a deletion does not mutate history', async () => {
    render(<HistorySetting />)
    fireEvent.click(screen.getByRole('button', { name: 'history.clear_all' }))
    await screen.findByRole('dialog')
    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }))
    expect(mocks.history.mock.calls.some(([op]) => op === 'clear')).toBe(false)
  })
})
