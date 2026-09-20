import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import HtmlPreview from './HtmlPreview'

vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
afterEach(cleanup)

it('refreshes identical HTML by replacing the sandbox frame, without changing the source', async () => {
  const source = '<h1>Preview</h1>'
  const { container, getByRole } = render(<HtmlPreview content={source} />)
  await waitFor(() => expect(container.querySelector('iframe')).not.toBeNull())
  const original = container.querySelector('iframe')!
  expect(original.getAttribute('sandbox')).toBe('allow-scripts')
  expect(original.getAttribute('srcdoc')).toContain(source)
  fireEvent.click(getByRole('button', { name: 'document_preview.refresh' }))
  await waitFor(() => {
    expect(container.querySelector('iframe')).not.toBeNull()
    expect(container.querySelector('iframe')).not.toBe(original)
  })
  expect(original.isConnected).toBe(false)
})
