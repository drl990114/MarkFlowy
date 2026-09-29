import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import HtmlPreview from './HtmlPreview'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
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
