import { TooltipProvider } from '@/components/ui/tooltip'
import { installUpdate } from '@/helper/updater'
import useUpdaterStore from '@/stores/useUpdaterStore'
import type { Update } from '@tauri-apps/plugin-updater'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TitleBar from '.'

const platform = vi.hoisted(() => ({ osType: 'macos' }))

vi.mock('@/helper/updater', () => ({ installUpdate: vi.fn() }))
vi.mock('@/hooks', () => ({ useGlobalOSInfo: () => platform }))
vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'updater.download_and_install': 'Download and install',
        'updater.downloading': 'Downloading new version…',
      })[key] ?? key,
  }),
}))
vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: unknown) => unknown) =>
    selector({ folderData: [], editorLayout: { type: 'leaf', id: 'group', opened: [] } }),
}))
vi.mock('../WorkspaceActions', () => ({ WorkspaceActions: () => <button>Open</button> }))
vi.mock('./DocumentTitle', () => ({ DocumentTitle: () => null }))
vi.mock('./AppMenuButton', () => ({ AppMenuButton: () => <button>App menu</button> }))
vi.mock('./WindowControls', () => ({ WindowControls: () => <button>Close window</button> }))
vi.mock('./useWindowFullscreen', () => ({ useWindowFullscreen: () => false }))

const update = { version: '1.2.3' } as Update

function renderTitleBar() {
  return render(
    <TooltipProvider>
      <TitleBar />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  platform.osType = 'macos'
  useUpdaterStore.setState({ update: null, isInstalling: false, installedVersion: null })
})

afterEach(cleanup)

describe('TitleBar update action', () => {
  it('stays hidden until a new version is found, then appears immediately before the menu', () => {
    renderTitleBar()
    expect(screen.queryByRole('button', { name: /Download and install/ })).toBeNull()

    act(() => useUpdaterStore.setState({ update }))
    const button = screen.getByRole('button', { name: 'Download and install · v1.2.3' })
    expect(button.nextElementSibling).toBe(screen.getByRole('button', { name: 'App menu' }))
    expect(button.classList.contains('bg-update-action')).toBe(true)
    expect(button.hasAttribute('data-tauri-drag-region')).toBe(false)
    expect(button.parentElement?.hasAttribute('data-tauri-drag-region')).toBe(false)

    fireEvent.click(button)
    expect(installUpdate).toHaveBeenCalledExactlyOnceWith(update)
  })

  it('disables installation while busy and permits retry after a failure', () => {
    useUpdaterStore.setState({ update })
    renderTitleBar()

    act(() => useUpdaterStore.setState({ isInstalling: true }))
    const button = screen.getByRole('button', { name: 'Downloading new version…' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    fireEvent.click(button)
    expect(installUpdate).not.toHaveBeenCalled()

    act(() => useUpdaterStore.setState({ isInstalling: false }))
    fireEvent.click(screen.getByRole('button', { name: 'Download and install · v1.2.3' }))
    expect(installUpdate).toHaveBeenCalledExactlyOnceWith(update)
  })

  it('removes the action after successful installation', () => {
    useUpdaterStore.setState({ update, isInstalling: true })
    renderTitleBar()

    act(() =>
      useUpdaterStore.setState({ update: null, isInstalling: false, installedVersion: '1.2.3' }),
    )
    expect(screen.queryByRole('button', { name: /Downloading|Download and install/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'App menu' })).toBeTruthy()
  })

  it('keeps the action before the menu and native controls on Windows', () => {
    platform.osType = 'windows'
    useUpdaterStore.setState({ update })
    renderTitleBar()

    const button = screen.getByRole('button', { name: 'Download and install · v1.2.3' })
    const menu = screen.getByRole('button', { name: 'App menu' })
    expect(button.nextElementSibling).toBe(menu)
    expect(menu.nextElementSibling).toBe(screen.getByRole('button', { name: 'Close window' }))
  })

  it('preserves the native Linux title bar', () => {
    platform.osType = 'linux'
    useUpdaterStore.setState({ update })
    expect(renderTitleBar().container.childElementCount).toBe(0)
  })
})
