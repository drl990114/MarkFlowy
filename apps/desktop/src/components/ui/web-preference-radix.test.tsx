import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PreferenceMenu from '../../../../web/components/PreferenceMenu'

const router = vi.hoisted(() => ({ events: { on: vi.fn(), off: vi.fn() } }))
vi.mock('next/router', () => ({ useRouter: () => router }))
afterEach(cleanup)

describe('Web preference menu Radix migration', () => {
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
    await waitFor(() => expect(document.activeElement).toBe(dark))
    expect(screen.getByRole('menuitemradio', { name: 'Light' }).getAttribute('aria-checked')).toBe(
      'true',
    )
    await user.keyboard('{Enter}')
    expect(onValueChange).toHaveBeenCalledWith('dark')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
