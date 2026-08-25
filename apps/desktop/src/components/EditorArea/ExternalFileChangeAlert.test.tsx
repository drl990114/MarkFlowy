import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import useExternalFileChangeStore from '@/stores/useExternalFileChangeStore'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExternalFileChangeAlert } from './ExternalFileChangeAlert'

const resolveExternalFileChange = vi.hoisted(() => vi.fn())

vi.mock('@/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('./externalFileChanges', () => ({ resolveExternalFileChange }))

describe('ExternalFileChangeAlert', () => {
  afterEach(() => {
    cleanup()
    resolveExternalFileChange.mockClear()
    useExternalFileChangeStore.getState().clearAll()
  })

  it('explains a conflict and exposes Update and Overwrite actions', () => {
    useExternalFileChangeStore.getState().setNotice('file', {
      diskRevision: 'disk:new',
      kind: 'conflict',
    })

    render(<ExternalFileChangeAlert fileId='file' />)

    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('external_file_change.conflict')
    expect(alert.textContent).toContain('external_file_change.conflict_description')
    expect(alert.className).toContain('bg-warning/[0.06]')
    expect(alert.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'external_file_change.update' }))
    fireEvent.click(screen.getByRole('button', { name: 'external_file_change.overwrite' }))
    expect(resolveExternalFileChange).toHaveBeenNthCalledWith(1, 'file', 'reload')
    expect(resolveExternalFileChange).toHaveBeenNthCalledWith(2, 'file', 'overwrite')
  })

  it('disables both decisions while a conflict is being resolved', () => {
    useExternalFileChangeStore.getState().setNotice('file', {
      diskRevision: 'disk:new',
      kind: 'conflict',
      resolving: 'reload',
    })

    render(<ExternalFileChangeAlert fileId='file' />)

    expect(screen.getByRole('alert').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('alert').querySelector('.animate-spin')).not.toBeNull()
    screen
      .getAllByRole('button')
      .forEach((button) => expect((button as HTMLButtonElement).disabled).toBe(true))
  })

  it('renders an unobtrusive status without actions after an automatic reload', () => {
    useExternalFileChangeStore.getState().setNotice('file', {
      kind: 'updated',
      status: 'reloaded',
      token: 1,
    })

    render(<ExternalFileChangeAlert fileId='file' />)

    const status = screen.getByRole('status')
    expect(status.textContent).toContain('external_file_change.reloaded')
    expect(status.className).toContain('bg-success/[0.04]')
    expect(status.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(screen.queryByRole('button')).toBeNull()
  })
})
