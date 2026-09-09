import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { desktopLightTheme } from '@markflowy/theme'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeStore } from './index'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
  confirm: vi.fn(),
  loadCss: vi.fn(),
  loadExtension: vi.fn(),
  deleteTheme: vi.fn(),
  t: (key: string) => key,
}))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: mocks.t }) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: mocks.confirm } }))
vi.mock('@/helper/extensions', () => ({ loadLocalThemeCss: mocks.loadCss }))
vi.mock('@/helper/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/stores/useThemeStore', () => ({
  default: () => ({ themes: [], deleteTheme: mocks.deleteTheme }),
}))
vi.mock('@/stores/useExtensionsManagerStore', () => ({
  default: { getState: () => ({ loadExtension: mocks.loadExtension }) },
}))

const localTheme = { id: 'local-1', name: 'Paper', css_content: '.paper {}', path: '/paper.css' }

function mount() {
  return render(
    <ThemeProvider theme={desktopLightTheme}>
      <ThemeStore />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.invoke.mockImplementation(async (command: string) =>
    command === 'load_local_themes' ? [localTheme] : [],
  )
  mocks.confirm.mockResolvedValue('confirm')
  mocks.open.mockResolvedValue(null)
})
afterEach(cleanup)

describe('ThemeStore feedback', () => {
  it('distinguishes a failed load from an empty list and retries in place', async () => {
    mocks.invoke.mockRejectedValueOnce(new Error('Themes are unavailable'))
    mount()
    expect(screen.queryByText('settings.themeStore.no_local_themes')).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'common.import CSS' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect((await screen.findByRole('alert')).textContent).toContain('Themes are unavailable')
    mocks.invoke.mockResolvedValueOnce([])
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    await screen.findByText('settings.themeStore.no_local_themes')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('retains a local theme after failed removal and supports a successful retry', async () => {
    mount()
    await screen.findByText('Paper')
    mocks.invoke.mockRejectedValueOnce(new Error('Permission denied'))
    fireEvent.click(screen.getByRole('button', { name: 'common.delete' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Permission denied')
    expect(screen.getByText('Paper')).toBeTruthy()
    expect(mocks.loadCss).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    await waitFor(() => expect(screen.queryByText('Paper')).toBeNull())
    expect(mocks.loadCss).toHaveBeenCalledWith([])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('locks a pending action without changing installed state before success', async () => {
    let finish!: () => void
    mount()
    await screen.findByText('Paper')
    mocks.invoke.mockImplementation((command: string) =>
      command === 'remove_local_theme'
        ? new Promise<void>((resolve) => {
            finish = resolve
          })
        : Promise.resolve([]),
    )
    const remove = screen.getByRole('button', { name: 'common.delete' }) as HTMLButtonElement
    fireEvent.click(remove)
    fireEvent.click(remove)
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    expect(remove.disabled).toBe(true)
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Paper')).toBeTruthy()
    await act(async () => finish())
    expect(screen.queryByText('Paper')).toBeNull()
  })

  it('treats a cancelled import as a normal return, leaving existing CSS untouched', async () => {
    mount()
    await screen.findByText('Paper')
    fireEvent.click(screen.getByRole('button', { name: 'common.import CSS' }))
    await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Paper')).toBeTruthy()
    expect(mocks.loadCss).not.toHaveBeenCalled()
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
  })

  it('keeps the trigger focusable during confirmation and does not remove on cancellation', async () => {
    let cancel!: (value: string) => void
    mocks.confirm.mockImplementation(() => new Promise<string>((resolve) => { cancel = resolve }))
    mount()
    await screen.findByText('Paper')
    const remove = screen.getByRole('button', { name: 'common.delete' }) as HTMLButtonElement
    remove.focus()
    fireEvent.click(remove)
    fireEvent.click(remove)
    expect(mocks.confirm).toHaveBeenCalledTimes(1)
    expect(remove.disabled).toBe(false)
    expect(document.activeElement).toBe(remove)
    await act(async () => cancel('cancel'))
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Paper')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows a failed download beside the online theme and refreshes extensions after retry', async () => {
    mount()
    await screen.findByText('Paper')
    mocks.invoke.mockRejectedValueOnce(new Error('Download interrupted'))
    fireEvent.click(screen.getAllByRole('button', { name: 'settings.themeStore.download' })[0])
    expect((await screen.findByRole('alert')).textContent).toContain('Download interrupted')
    expect(mocks.loadExtension).not.toHaveBeenCalled()
    const extension = { id: 'downloaded-theme', script_text: '/* theme fixture */' }
    mocks.invoke.mockResolvedValueOnce(undefined).mockResolvedValueOnce([extension])
    fireEvent.click(screen.getByRole('button', { name: 'common.retry' }))
    await waitFor(() => expect(mocks.loadExtension).toHaveBeenCalledWith(extension))
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
