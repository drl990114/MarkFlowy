import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LanguageSwitcher from '../../../../web/components/Nav/LanguageSwitcher'
import PreferenceMenu from '../../../../web/components/PreferenceMenu'

const router = vi.hoisted(() => ({
  events: { on: vi.fn(), off: vi.fn() },
  locale: 'en',
  pathname: '/docs/[...slug]',
  asPath: '/docs/guide?source=menu#install',
  query: { slug: ['guide'], source: 'menu' },
  push: vi.fn(),
}))
vi.mock('next/router', () => ({ useRouter: () => router }))
vi.mock('next-i18next', () => ({
  useTranslation: () => ({ t: () => 'Language' }),
}))
const preferenceStyles = readFileSync(
  resolve(import.meta.dirname, '../../../../web/components/theme.css'),
  'utf8',
)
let styleElement: HTMLStyleElement
beforeEach(() => {
  styleElement = document.createElement('style')
  styleElement.textContent = preferenceStyles
  document.head.append(styleElement)
})
afterEach(() => {
  cleanup()
  styleElement.remove()
})

describe('Web preference menu Radix migration', () => {
  it('shows the menu after a pointer click and applies the selected preference', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <PreferenceMenu
        label='Language'
        icon={<span aria-hidden>文</span>}
        value='en'
        options={[
          { value: 'en', label: 'English', icon: null },
          { value: 'zh', label: '中文', icon: null },
        ]}
        onValueChange={onValueChange}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Language' })
    await user.click(trigger)
    const menu = await screen.findByRole('menu', { name: 'Language' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(getComputedStyle(menu).opacity).toBe('1')
    expect(
      screen.getByRole('menuitemradio', { name: 'English' }).getAttribute('aria-checked'),
    ).toBe('true')

    await user.click(screen.getByRole('menuitemradio', { name: '中文' }))
    expect(onValueChange).toHaveBeenCalledWith('zh')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('preserves ArrowUp-to-last, radio selection, and focus restoration', async () => {
    const user = userEvent.setup()
    const onValueChange = vi.fn()
    render(
      <PreferenceMenu
        label='Appearance'
        icon={<span aria-hidden>◐</span>}
        value='light'
        options={[
          { value: 'light', label: 'Light', icon: null },
          { value: 'dark', label: 'Dark', icon: null },
        ]}
        onValueChange={onValueChange}
      />,
    )
    const trigger = screen.getByRole('button', { name: 'Appearance' })
    trigger.focus()
    await user.keyboard('{ArrowUp}')
    const dark = await screen.findByRole('menuitemradio', { name: 'Dark' })
    expect(getComputedStyle(screen.getByRole('menu', { name: 'Appearance' })).opacity).toBe('1')
    await waitFor(() => expect(document.activeElement).toBe(dark))
    expect(screen.getByRole('menuitemradio', { name: 'Light' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    await user.keyboard('{Enter}')
    expect(onValueChange).toHaveBeenCalledWith('dark')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it.each([
    ['zh', 'en', 'English'],
    ['en', 'zh', '中文'],
  ])(
    'remembers %s → %s from a nested page without losing route details',
    async (from, to, label) => {
      const originalPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
      window.history.replaceState(null, '', '/docs/guide?source=menu#install')
      document.cookie = `NEXT_LOCALE=${from}; Path=/`
      router.locale = from
      router.push.mockClear()

      try {
        const user = userEvent.setup()
        render(<LanguageSwitcher />)
        await user.click(screen.getByRole('button', { name: 'Language' }))
        await user.click(await screen.findByRole('menuitemradio', { name: label }))

        expect(router.push).toHaveBeenCalledWith(
          { pathname: router.pathname, query: router.query },
          router.asPath,
          { locale: to },
        )
        // Next reads the root cookie on a later visit to / before Accept-Language.
        window.history.replaceState(null, '', '/')
        expect(document.cookie).toBe(`NEXT_LOCALE=${to}`)
      } finally {
        document.cookie = 'NEXT_LOCALE=; Path=/; Max-Age=0'
        window.history.replaceState(null, '', originalPath)
      }
    },
  )
})
