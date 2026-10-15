import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ThemeDocument } from '@markflowy/theme/semantic'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { i18nInit } from '../../../../../../packages/i18n/src/desktop'
import { CommunityThemeItem } from './CommunityThemeItem'
import { communityThemeQueryOptions, type ThemeItem } from './communityThemes'

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), install: vi.fn() }))
vi.mock('@/i18n', async () => import('../../../../../../packages/i18n/src/desktop'))
vi.mock('@tauri-apps/plugin-http', () => ({ fetch: mocks.fetch }))

const item: ThemeItem = {
  id: 'ocean',
  name: 'Ocean',
  author: 'Mina',
  version: '1.0.0',
  url: 'https://example.com/ocean.json',
}
const document: ThemeDocument = {
  version: 1,
  id: item.id,
  name: item.name,
  variants: [
    {
      id: 'dark',
      name: 'Night',
      mode: 'dark',
      tokens: { 'editor.background': '#112233', 'accent.background': '#56789a' },
      css: 'body { display: none; }',
    },
    {
      id: 'light',
      name: 'Day',
      mode: 'light',
      tokens: {
        'surface.canvas': '#fff1e2',
        'editor.background': { ref: 'surface.canvas' },
        'accent.background': '#235678',
      },
    },
  ],
}
let client: QueryClient
const node = (mode: 'light' | 'dark' = 'dark', entry = item, selectOnInstall = false) => (
  <QueryClientProvider client={client}>
    <CommunityThemeItem
      item={entry}
      mode={mode}
      pending={false}
      selectOnInstall={selectOnInstall}
      onInstall={mocks.install}
    />
  </QueryClientProvider>
)
const palette = () =>
  screen.getByRole('article', { name: 'Ocean' }).querySelector('[data-slot="theme-palette"]')

beforeEach(async () => {
  await i18nInit({ lng: 'en' })
  vi.resetAllMocks()
  client = new QueryClient()
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => document })
})
afterEach(() => {
  cleanup()
  client.clear()
  vi.useRealTimers()
})

describe('community theme token previews', () => {
  it('disables selection when the requested display mode has no variant', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ...document, variants: [document.variants[0]] }),
    })
    render(node('light', item, true))
    const button = await screen.findByRole('button', { name: 'No light variant' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Dark')).toBeTruthy()
    fireEvent.click(button)
    expect(mocks.install).not.toHaveBeenCalled()
  })
  it('renders resolved remote tokens in the current mode without applying its CSS or installing', async () => {
    const view = render(node('light'))
    await waitFor(() =>
      expect(palette()?.querySelector('rect')?.getAttribute('fill')).toBe('#fff1e2ff'),
    )
    expect(palette()?.querySelectorAll('rect')[3].getAttribute('fill')).toBe('#235678ff')
    expect(screen.getByText('Light')).toBeTruthy()

    view.rerender(node('dark'))
    expect(palette()?.querySelector('rect')?.getAttribute('fill')).toBe('#112233ff')
    expect(screen.getByText('Dark')).toBeTruthy()
    expect(screen.queryByText(document.variants[0].css!)).toBeNull()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
    expect(mocks.install).not.toHaveBeenCalled()
  })

  it('reuses the preview after reopening and fetches a new catalog version separately', async () => {
    const first = render(node())
    await waitFor(() => expect(palette()).not.toBeNull())
    first.unmount()
    const second = render(node())
    expect(palette()).not.toBeNull()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)

    const next = {
      ...document,
      variants: [{ ...document.variants[0], tokens: { 'editor.background': '#445566' } }],
    }
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => next })
    second.rerender(
      node('dark', { ...item, version: '2.0.0', url: 'https://example.com/ocean-v2.json' }),
    )
    await waitFor(() =>
      expect(palette()?.querySelector('rect')?.getAttribute('fill')).toBe('#445566ff'),
    )
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it('allows installing after a preview failure and retries the remote request', async () => {
    mocks.fetch.mockRejectedValueOnce(new Error('Offline'))
    render(node())
    const retry = await screen.findByRole('button', { name: 'Retry preview: Ocean' })
    expect(palette()).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Install' }))
    expect(mocks.install).toHaveBeenCalledTimes(1)
    fireEvent.click(retry)
    await waitFor(() => expect(palette()).not.toBeNull())
    expect(mocks.fetch).toHaveBeenCalledTimes(2)
  })

  it.each([
    { ...document, id: 'different-theme' },
    {
      ...document,
      variants: [{ ...document.variants[0], tokens: { 'editor.background': 'url(unsafe)' } }],
    },
  ])('does not preview a mismatched or invalid theme', async (invalidDocument) => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => invalidDocument })
    render(node())
    await screen.findByRole('button', { name: 'Retry preview: Ocean' })
    expect(palette()).toBeNull()
    expect(mocks.install).not.toHaveBeenCalled()
  })

  it('cancels an unfinished native download when its preview leaves the page', async () => {
    mocks.fetch.mockImplementation(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    )
    const view = render(node())
    expect(screen.getByRole('status', { name: 'Loading theme preview' })).toBeTruthy()
    const signal = (mocks.fetch.mock.calls[0][1] as RequestInit).signal
    await act(async () => view.unmount())
    expect(signal?.aborted).toBe(true)
  })

  it('bounds a stalled native download so the preview can be retried', async () => {
    vi.useFakeTimers()
    mocks.fetch.mockImplementation(
      (_url: string, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(options.signal?.reason), {
            once: true,
          })
        }),
    )
    const result = client.fetchQuery(communityThemeQueryOptions(item))
    const rejection = expect(result).rejects.toThrow('Theme download timed out')
    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
  })
})
