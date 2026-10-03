import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import HtmlPreview from './HtmlPreview'

const invoke = vi.hoisted(() => vi.fn())
vi.mock('@tauri-apps/api/core', () => ({ invoke }))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
beforeEach(() => invoke.mockReset())
afterEach(cleanup)

it('runs scripts only after explicit approval and resets trust when content changes', async () => {
  const source = '<script>location.replace("https://example.com/leak")</script><h1>Preview</h1>'
  const { container, getByRole, rerender } = render(<HtmlPreview content={source} />)
  await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull())
  const original = container.querySelector('iframe')!
  expect(original.getAttribute('sandbox')).toBe('')
  expect(original.getAttribute('srcdoc')).toContain(
    '<script>location.replace("https://example.com/leak")</script>',
  )
  fireEvent.click(getByRole('button', { name: 'document_preview.run_scripts' }))
  const trusted = container.querySelector('iframe')!
  expect(trusted).not.toBe(original)
  expect(trusted.getAttribute('sandbox')).toBe('allow-scripts')

  rerender(<HtmlPreview content='<h1>Updated</h1>' />)
  await waitFor(() => {
    expect(container.querySelector('iframe')?.getAttribute('srcdoc')).toContain('Updated')
  })
  expect(container.querySelector('iframe')?.getAttribute('sandbox')).toBe('')
})

it('refreshes identical HTML by replacing the sandbox frame without changing the source', async () => {
  const source = '<h1>Preview</h1>'
  const { container, getByRole } = render(<HtmlPreview content={source} />)
  await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull())
  const original = container.querySelector('iframe')!
  fireEvent.click(getByRole('button', { name: 'document_preview.refresh' }))
  await waitFor(() => {
    expect(container.querySelector('iframe')).not.toBeNull()
    expect(container.querySelector('iframe')).not.toBe(original)
  })
  expect(original.isConnected).toBe(false)
})

it('shows individual resource failures and a folder hint without hiding the preview', async () => {
  invoke.mockRejectedValueOnce({ code: 'not_found' })
  const view = render(
    <HtmlPreview
      content='<img src="missing.jpg"><img src="../assets/photo.jpg">'
      filePath='/site/pages/index.html'
    />,
  )
  await waitFor(() => expect(view.container.querySelector('iframe')).not.toBeNull())
  fireEvent.click(view.getByRole('button', { name: 'document_preview.resources_blocked (2)' }))
  expect(view.getByRole('dialog').textContent).toContain('missing.jpg')
  expect(view.getByRole('dialog').textContent).toContain(
    'document_preview.resource_errors.not_found',
  )
  expect(view.getByRole('dialog').textContent).toContain('../assets/photo.jpg')
  expect(view.getByRole('dialog').textContent).toContain(
    'document_preview.resource_errors.outside_root',
  )
  expect(view.getByRole('dialog').textContent).toContain('document_preview.resource_folder_hint')
  expect(view.container.querySelector('iframe')?.getAttribute('sandbox')).toBe('')
})
