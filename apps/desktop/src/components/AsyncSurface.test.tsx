import { desktopDarkTheme } from '@markflowy/theme'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from 'styled-components'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AsyncSurface, type AsyncSurfaceState } from './AsyncSurface'

afterEach(cleanup)

function renderSurface(state: AsyncSurfaceState<string>) {
  return render(
    <ThemeProvider theme={desktopDarkTheme}>
      <AsyncSurface state={state}>{(data) => <div>{data}</div>}</AsyncSurface>
    </ThemeProvider>,
  )
}

describe('AsyncSurface', () => {
  it('renders loading, empty and blocked states with status semantics', () => {
    const loading = renderSurface({ status: 'loading', label: 'Loading files' })
    expect(screen.getByRole('status').textContent).toContain('Loading files')
    loading.unmount()

    const empty = renderSurface({ status: 'empty', title: 'No files' })
    expect(screen.getByRole('status').textContent).toContain('No files')
    empty.unmount()

    renderSurface({ status: 'blocked', title: 'Choose a workspace', action: <button>Open</button> })
    expect(screen.getByRole('status').textContent).toContain('Choose a workspace')
    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
  })

  it('announces errors and exposes retry', () => {
    const retry = vi.fn()
    renderSurface({ status: 'error', title: 'Could not load', retry })

    expect(screen.getByRole('alert').textContent).toContain('Could not load')
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('renders ready data', () => {
    renderSurface({ status: 'ready', data: 'Ready content' })
    expect(screen.getByText('Ready content')).toBeTruthy()
  })
})
