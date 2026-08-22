import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WorkspaceStartupSurface } from './WorkspaceStartupSurface'

vi.mock('@/i18n', () => ({
  t: (key: string) =>
    ({
      'common.fetching': 'Loading',
      'common.retry': 'Retry',
      'file.openDir': 'Open Folder',
    })[key] ?? key,
}))

afterEach(cleanup)

describe('WorkspaceStartupSurface', () => {
  it('keeps ready-only workspace content hidden while loading', () => {
    render(
      <WorkspaceStartupSurface retry={vi.fn()} state={{ status: 'loading' }}>
        <div>Workspace welcome</div>
      </WorkspaceStartupSurface>,
    )

    expect(screen.getByRole('status')).toBeTruthy()
    expect(document.querySelector('.mf-boot-progress')).toBeTruthy()
    expect(document.querySelector('.animate-spin')).toBeNull()
    expect(screen.queryByText('Workspace welcome')).toBeNull()
    expect(document.querySelector('[data-mf-workspace-shell="editor"]')).toBeTruthy()
    const statusBar = document.querySelector('[data-mf-workspace-shell="status-bar"]')
    expect(statusBar?.classList.contains('bg-surface-statusbar')).toBe(true)
    expect(statusBar?.classList.contains('bg-surface-titlebar')).toBe(false)
  })

  it('renders workspace content only when ready', () => {
    render(
      <WorkspaceStartupSurface retry={vi.fn()} state={{ status: 'ready', data: undefined }}>
        <div>Workspace welcome</div>
      </WorkspaceStartupSurface>,
    )

    expect(screen.getByText('Workspace welcome')).toBeTruthy()
  })

  it('shows the workspace failure and retries without restarting the shell', () => {
    const retry = vi.fn()
    const chooseWorkspace = vi.fn()
    render(
      <WorkspaceStartupSurface
        chooseWorkspace={chooseWorkspace}
        retry={retry}
        state={{ status: 'error', error: new Error('Permission denied') }}
      >
        <div>Workspace welcome</div>
      </WorkspaceStartupSurface>,
    )

    expect(screen.getByRole('alert').textContent).toContain('Permission denied')
    expect(screen.queryByText('Workspace welcome')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Open Folder' }))
    expect(chooseWorkspace).toHaveBeenCalledTimes(1)
  })
})
